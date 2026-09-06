import { getCached, setCached, tryOverpass } from "./overpass.js";
import { tryNominatim } from "./nominatim.js";

// Progressive search radii (meters): start tight, widen only if genuinely
// nothing was found nearby. LocalFinder's whole purpose is to find the
// nearest *available* service, not to give up at an arbitrary default.
const RADIUS_LADDER_M = [5000, 10000, 15000];

function buildRadiusLadder(startRadius) {
  const ladder = [startRadius];
  for (const r of RADIUS_LADDER_M) {
    if (r > startRadius) ladder.push(r);
  }
  return ladder;
}

/**
 * Finds nearby places for a category at one specific radius, trying
 * Overpass first (primary, richer data - phone/address/opening hours)
 * and falling back to Nominatim only if every Overpass mirror failed.
 * Never throws: on total failure it returns an empty list with
 * `degraded: true` and a human-readable reason, so the endpoint can
 * respond with 200 and a useful message instead of breaking the page.
 *
 * `preferredMirror` is passed through to tryOverpass so a caller doing
 * radius expansion can reuse whichever mirror already proved responsive,
 * instead of re-scanning all mirrors at every radius tier.
 */
export async function findNearbyPlaces({ lat, lng, category, radius, preferredMirror = null, skipOverpass = false }) {
  const cached = getCached(category, radius, lat, lng);
  if (cached) {
    return { elements: cached, provider: "cache", degraded: false, mirrorUsed: preferredMirror };
  }

  let overpassElements = null;
  let mirrorUsed = null;
  if (!skipOverpass) {
    ({ elements: overpassElements, mirrorUsed } = await tryOverpass(category, radius, lat, lng, preferredMirror));
  }
  if (overpassElements !== null) {
    setCached(category, radius, lat, lng, overpassElements);
    return { elements: overpassElements, provider: "overpass", degraded: false, mirrorUsed };
  }

  const nominatimElements = await tryNominatim(category, radius, lat, lng);
  if (nominatimElements !== null) {
    setCached(category, radius, lat, lng, nominatimElements);
    return { elements: nominatimElements, provider: "nominatim", degraded: false, mirrorUsed: null };
  }

  return {
    elements: [],
    provider: "none",
    degraded: true,
    message:
      "We couldn't reach live map data right now. This is usually temporary - please try again in a moment.",
    mirrorUsed: null,
  };
}

/**
 * Finds nearby places starting at `startRadius`, automatically widening
 * through RADIUS_LADDER_M (e.g. 3km -> 5km -> 10km -> 15km) as long as
 * each attempt genuinely succeeds but finds nothing. Stops as soon as
 * real results are found at some radius, or immediately on a real
 * upstream failure (a degraded attempt is surfaced as-is, never
 * reinterpreted as "no results" and never used as a reason to keep
 * escalating - that would just multiply load on a service that's
 * already down).
 *
 * Remembers whichever Overpass mirror responded on the first attempt
 * and reuses it for later radius tiers, so a sparse-result category
 * doesn't re-scan all 5 mirrors at every one of the (up to 4) radius
 * levels - that would otherwise multiply worst-case latency severely.
 * If Overpass fails outright (every mirror) on one tier, that's treated
 * as "Overpass is currently unreachable" for the rest of this search -
 * later tiers skip straight to Nominatim rather than re-running the
 * same full mirror scan again for each wider radius.
 */
export async function findNearbyPlacesExpanding({ lat, lng, category, startRadius }) {
  const ladder = buildRadiusLadder(startRadius);
  let preferredMirror = null;
  let overpassAppearsDown = false;

  for (const radius of ladder) {
    const result = await findNearbyPlaces({
      lat,
      lng,
      category,
      radius,
      preferredMirror,
      skipOverpass: overpassAppearsDown,
    });

    if (result.mirrorUsed) {
      preferredMirror = result.mirrorUsed;
    } else if (!overpassAppearsDown && result.provider !== "cache") {
      overpassAppearsDown = true;
    }

    if (result.degraded) {
      return { ...result, radiusUsed: radius };
    }
    if (result.elements.length > 0) {
      return { ...result, radiusUsed: radius };
    }
    // genuinely empty at this radius - try the next, wider one
  }

  return {
    elements: [],
    provider: "none",
    degraded: false,
    radiusUsed: ladder[ladder.length - 1],
  };
}
