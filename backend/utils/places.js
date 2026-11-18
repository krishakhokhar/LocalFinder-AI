import { getCached, setCached, tryOverpass } from "./overpass.js";
import { tryNominatim } from "./nominatim.js";
import { createLogger } from "./logger.js";

const log = createLogger("places");

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
export async function findNearbyPlaces({
  lat,
  lng,
  category,
  radius,
  preferredMirror = null,
  skipOverpass = false,
  deadline = null,
}) {
  const cached = getCached(category, radius, lat, lng);
  if (cached) {
    return { elements: cached, provider: "cache", degraded: false, mirrorUsed: preferredMirror };
  }

  let overpassElements = null;
  let mirrorUsed = null;
  if (!skipOverpass) {
    ({ elements: overpassElements, mirrorUsed } = await tryOverpass(
      category,
      radius,
      lat,
      lng,
      preferredMirror,
      deadline,
      log
    ));
  }
  if (overpassElements !== null) {
    setCached(category, radius, lat, lng, overpassElements);
    log.debug(
      `overpass ok category=${category} radius=${radius} elements=${overpassElements.length} mirror=${mirrorUsed}`
    );
    return { elements: overpassElements, provider: "overpass", degraded: false, mirrorUsed };
  }

  log.warn(`overpass unavailable for category=${category} radius=${radius}; falling back to nominatim`);

  const nominatimElements = await tryNominatim(category, radius, lat, lng, deadline);
  if (nominatimElements !== null) {
    log.debug(`nominatim fallback returned ${nominatimElements.length} elements`);

    // An empty fallback result is NOT evidence that the area is empty.
    // Nominatim is a free-text geocoder, not a tag-and-radius search, and
    // it regularly returns nothing where Overpass finds real places - two
    // salons in this very test area. Reporting that as a confident "no
    // results" is how a provider outage got shown to users as an empty
    // neighbourhood, so an empty fallback is flagged as incomplete.
    if (nominatimElements.length === 0) {
      return {
        elements: [],
        provider: "nominatim",
        degraded: true,
        message:
          "Live map search is temporarily limited, so this result may be incomplete. Please try again in a moment.",
        mirrorUsed: null,
      };
    }

    setCached(category, radius, lat, lng, nominatimElements);
    return { elements: nominatimElements, provider: "nominatim", degraded: false, mirrorUsed: null };
  }

  log.error(`both overpass and nominatim failed for category=${category} radius=${radius}`);

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
/**
 * Overall time budget for one search, across every radius tier.
 *
 * Four tiers, each able to try several mirrors at six seconds apiece,
 * can add up to a request nobody waits for - and a platform proxy will
 * often cut it off before we answer anyway. Once the budget is spent
 * the search stops widening and returns what it has, flagged with
 * `timedOut` so the caller can say the search was cut short rather than
 * implying the area is empty.
 */
/*
 * Sized from measurement, not guesswork. Worst realistic cold start:
 * three unreachable mirrors each holding a concurrency slot for 4.5s
 * while hedging starts the next one every 1.5s, then a healthy mirror
 * needing ~3s for the widest query. That lands around 7.5s, so 15s
 * leaves genuine headroom without being a wait nobody tolerates.
 *
 * This only applies to a cold process: mirror health and the 3-minute
 * result cache mean subsequent searches settle in ~3s.
 */
const SEARCH_BUDGET_MS = 34000;

export async function findNearbyPlacesExpanding({
  lat,
  lng,
  category,
  startRadius,
  budgetMs = SEARCH_BUDGET_MS,
  // Off by default: the radius the user picked is the radius we search.
  // Quietly returning places from 15 km under a "3 km" filter made the
  // distance figures look wrong and the filter feel broken. When nothing
  // is found we report `suggestedRadius` instead, and the UI offers it.
  autoExpand = false,
}) {
  const ladder = autoExpand ? buildRadiusLadder(startRadius) : [startRadius];
  const wider = buildRadiusLadder(startRadius).filter((r) => r > startRadius);
  const suggestedRadius = wider.length > 0 ? wider[0] : null;
  const deadline = Date.now() + budgetMs;

  let preferredMirror = null;
  let overpassAppearsDown = false;
  let lastRadius = ladder[0];

  for (const radius of ladder) {
    lastRadius = radius;

    const result = await findNearbyPlaces({
      lat,
      lng,
      category,
      radius,
      preferredMirror,
      skipOverpass: overpassAppearsDown,
      deadline,
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

    // Genuinely empty at this radius. Only widen if there is time left -
    // a wider query is slower than the one that just finished, so going
    // on with a nearly-spent budget mostly produces a timeout.
    if (Date.now() >= deadline) {
      log.warn(`search budget spent at radius=${radius} with no results (provider=${result.provider})`);
      return {
        elements: [],
        provider: result.provider,
        // A search that ran out of time never finished looking. Reporting it
        // as a clean empty result would tell the user "there is nothing near
        // you", which we do not actually know.
        degraded: true,
        timedOut: true,
        message:
          "The search was cut short before it could finish. This is usually temporary - please try again.",
        radiusUsed: radius,
      };
    }
  }

  // Every tier completed and genuinely found nothing. This one *is* a real
  // empty result, so it is not flagged as degraded.
  log.info(`no results at ${lastRadius}m for category=${category}`);
  return {
    elements: [],
    provider: "none",
    degraded: false,
    radiusUsed: lastRadius,
    // Lets the UI offer "search 5 km instead" rather than widening behind
    // the user's back.
    suggestedRadius,
  };
}
