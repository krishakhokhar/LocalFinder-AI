import axios from "axios";

// "all" is the union of every named category's tags so "All" surfaces
// salons, plumbers, electricians, restaurants, spas and car services together.
export const CATEGORY_TAGS = {
  // Standard OSM tag for hair/beauty salons is shop=hairdresser|beauty,
  // not amenity= - amenity=hairdresser is essentially unused in practice.
  salon: '["shop"~"hairdresser|beauty"]["name"]',
  plumber: '["craft"="plumber"]["name"]',
  electrician: '["craft"="electrician"]["name"]',
  restaurant: '["amenity"~"restaurant|cafe|fast_food"]["name"]',
  spa: '["leisure"~"spa|fitness_centre"]["name"]',
  car: '["shop"~"car_repair|car"]["name"]',
};

const ALL_TAG_GROUPS = [
  '["amenity"~"restaurant|cafe|fast_food|hospital|pharmacy|bank|fuel"]["name"]',
  '["shop"~"hairdresser|beauty|car_repair|car"]["name"]',
  '["craft"~"plumber|electrician"]["name"]',
  '["leisure"~"spa|fitness_centre"]["name"]',
];

export const VALID_CATEGORIES = ["all", ...Object.keys(CATEGORY_TAGS)];

// Multiple independently-operated public mirrors. The free Overpass API
// is known to rate-limit or reject traffic from cloud/datacenter IP
// ranges (which is exactly what a Render-hosted backend is), so a
// single mirror - or even several - is not guaranteed reliable.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Identifies this app to OSM infrastructure, as their usage policies
// require/expect. A bare axios default User-Agent is one of the things
// that gets automated traffic deprioritized or blocked outright.
const APP_USER_AGENT = "LocalFinder-AI/1.0 (+https://github.com/krishakhokhar/LocalFinder-AI)";

// Kept tight: a mirror that has not answered in five seconds is almost
// always unreachable from this network rather than merely busy, and the
// next mirror is a better bet than waiting longer.
const PER_MIRROR_TIMEOUT_MS = 5000;
export const MIN_RADIUS_M = 100;
export const MAX_RADIUS_M = 20000;
export const DEFAULT_RADIUS_M = 3000;

// Short in-memory cache so repeated queries for the same area/category
// don't all hit Overpass again - this directly reduces the odds of
// tripping rate limits, and also reduces load on the Nominatim fallback.
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map();

function cacheKey(category, radius, lat, lng) {
  // Round coordinates to ~100m precision so nearby-identical queries share a cache entry.
  return `${category}:${radius}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
}

export function getCached(category, radius, lat, lng) {
  const entry = cache.get(cacheKey(category, radius, lat, lng));
  if (entry && Date.now() - entry.time < CACHE_TTL_MS) return entry.elements;
  return null;
}

export function setCached(category, radius, lat, lng, elements) {
  cache.set(cacheKey(category, radius, lat, lng), { elements, time: Date.now() });
}

// Keep the query as small as the category actually requires - a single
// tag filter and a capped result count, rather than pulling excess OSM
// data. "out center 30" is enough for a "nearby results" list while
// keeping the payload/processing Overpass has to do meaningfully smaller.
function buildQuery(category, radius, lat, lng) {
  const clauses =
    category === "all"
      ? ALL_TAG_GROUPS.flatMap((tag) => [
          `node${tag}(around:${radius},${lat},${lng});`,
          `way${tag}(around:${radius},${lat},${lng});`,
        ])
      : [
          `node${CATEGORY_TAGS[category]}(around:${radius},${lat},${lng});`,
          `way${CATEGORY_TAGS[category]}(around:${radius},${lat},${lng});`,
        ];

  return `
    [out:json][timeout:15];
    (
      ${clauses.join("\n      ")}
    );
    out center 30;
  `;
}

async function fetchFromMirror(url, query, timeoutMs = PER_MIRROR_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, PER_MIRROR_TIMEOUT_MS));

  try {
    const res = await axios.post(url, "data=" + encodeURIComponent(query), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": APP_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      // Covers 429 (rate limited), 403 (blocked), 502/503 (overloaded),
      // and anything else - move on to the next mirror, don't retry
      // the same one (a mirror that just rejected us won't accept a
      // second attempt moments later).
      throw new Error(`HTTP ${res.status}`);
    }

    if (!res.data || !Array.isArray(res.data.elements)) {
      throw new Error("Invalid/unexpected response shape");
    }

    return res.data;
  } catch (err) {
    if (err.code === "ERR_CANCELED" || err.name === "CanceledError") {
      throw new Error("timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries each Overpass mirror once, in sequence (never in parallel).
 * Returns { elements: null, mirrorUsed: null } (not a throw) if every
 * mirror fails, so callers can fall through to another provider instead
 * of treating this as fatal.
 *
 * `preferredMirror`, when given, is tried first (the rest follow in
 * their normal order as fallback). This matters for radius-expansion
 * callers: once one mirror is known to be responding, reusing it for
 * every subsequent radius attempt avoids re-scanning all 5 mirrors each
 * time, which would otherwise multiply worst-case latency by the number
 * of radius tiers.
 */
export async function tryOverpass(category, radius, lat, lng, preferredMirror = null, deadline = null) {
  const query = buildQuery(category, radius, lat, lng);
  const orderedMirrors = preferredMirror
    ? [preferredMirror, ...OVERPASS_MIRRORS.filter((url) => url !== preferredMirror)]
    : OVERPASS_MIRRORS;

  const failures = [];
  for (const url of orderedMirrors) {
    // Stop scanning once the caller's budget is spent. Five mirrors at
    // six seconds each is thirty seconds before Nominatim is even
    // tried, which is far longer than anyone waits - and mirrors that
    // are unreachable from a given network fail by timing out, not by
    // refusing quickly, so this is the common case rather than the
    // pathological one.
    if (deadline && Date.now() >= deadline) {
      failures.push("(budget exhausted, remaining mirrors skipped)");
      break;
    }

    try {
      const remaining = deadline ? Math.max(1000, deadline - Date.now()) : undefined;
      const data = await fetchFromMirror(url, query, remaining);
      return { elements: data.elements, mirrorUsed: url };
    } catch (err) {
      failures.push(`${url} -> ${err.message}`);
    }
  }

  console.warn("[overpass] all mirrors failed:\n  " + failures.join("\n  "));
  return { elements: null, mirrorUsed: null };
}

// ---------------------------------------------------------------------------
// Reverse mapping: OSM tags -> the category keys this product uses.
//
// Needed because a single filter ("Spa/Gym") can match several OSM values,
// and because the "all" query returns a mixture. Each result keeps its own
// real type so a gym is never mislabelled as a spa.
// ---------------------------------------------------------------------------

const OSM_VALUE_TO_CATEGORY = {
  hairdresser: "salon",
  beauty: "salon",
  plumber: "plumber",
  electrician: "electrician",
  restaurant: "restaurant",
  cafe: "restaurant",
  fast_food: "restaurant",
  spa: "spa",
  fitness_centre: "spa",
  car_repair: "car",
  car: "car",
  hospital: "health",
  clinic: "health",
  doctors: "health",
  pharmacy: "health",
  bank: "finance",
  atm: "finance",
  fuel: "fuel",
};

/** The raw OSM value that best describes an element (e.g. "fitness_centre"). */
export function osmTypeFromTags(tags = {}) {
  return (
    tags.amenity || tags.craft || tags.shop || tags.leisure || tags.office || tags.healthcare || null
  );
}

/** Our category key for an OSM element, or "other" when it maps to nothing. */
export function categoryFromTags(tags = {}) {
  const value = osmTypeFromTags(tags);
  if (!value) return "other";
  return OSM_VALUE_TO_CATEGORY[value] || "other";
}

/** Categories that external (OSM) search can actually serve. */
export function supportsExternalSearch(category) {
  return VALID_CATEGORIES.includes(category);
}
