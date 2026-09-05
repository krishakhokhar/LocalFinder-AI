import axios from "axios";

// "all" is the union of every named category's tags so "All" surfaces
// salons, plumbers, electricians, restaurants, spas and car services together.
export const CATEGORY_TAGS = {
  salon: '["amenity"~"hairdresser|beauty"]["name"]',
  plumber: '["craft"="plumber"]["name"]',
  electrician: '["craft"="electrician"]["name"]',
  restaurant: '["amenity"~"restaurant|cafe|fast_food"]["name"]',
  spa: '["leisure"~"spa|fitness_centre"]["name"]',
  car: '["shop"~"car_repair|car"]["name"]',
};

const ALL_TAG_GROUPS = [
  '["amenity"~"hairdresser|restaurant|cafe|fast_food|hospital|pharmacy|bank|fuel"]["name"]',
  '["craft"~"plumber|electrician"]["name"]',
  '["shop"~"car_repair|car"]["name"]',
  '["leisure"~"spa|fitness_centre"]["name"]',
];

export const VALID_CATEGORIES = ["all", ...Object.keys(CATEGORY_TAGS)];

// Multiple independently-operated public mirrors. The free Overpass API
// is known to rate-limit or reject traffic from cloud/datacenter IP
// ranges (which is exactly what a Render-hosted backend is), so a
// single mirror is not reliable in production - we try several in turn.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const PER_MIRROR_TIMEOUT_MS = 7000;
export const MIN_RADIUS_M = 100;
export const MAX_RADIUS_M = 20000;
export const DEFAULT_RADIUS_M = 3000;

// Short in-memory cache so repeated queries for the same area/category
// (common when several users search nearby locations, or the AI chat
// and the Services page query the same spot) don't all hit Overpass
// again - this directly reduces the odds of tripping rate limits.
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map();

function cacheKey(category, radius, lat, lng) {
  // Round coordinates to ~100m precision so nearby-identical queries share a cache entry.
  return `${category}:${radius}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
}

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
    [out:json][timeout:25];
    (
      ${clauses.join("\n      ")}
    );
    out center 60;
  `;
}

async function fetchFromMirror(url, query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_MIRROR_TIMEOUT_MS);

  try {
    const res = await axios.post(url, "data=" + encodeURIComponent(query), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      // Covers 429 (rate limited), 502/503 (mirror overloaded), and any
      // other non-success status - move on to the next mirror.
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

async function fetchOverpassWithFallback(query) {
  const failures = [];
  for (const url of OVERPASS_MIRRORS) {
    try {
      return await fetchFromMirror(url, query);
    } catch (err) {
      failures.push(`${url} -> ${err.message}`);
    }
  }
  console.warn("[overpass] all mirrors failed:\n  " + failures.join("\n  "));
  throw new Error("All Overpass mirrors failed");
}

/**
 * Fetches raw OSM elements near a point for a given category.
 * Throws if every mirror fails (caller decides the HTTP response for that case).
 */
export async function getNearbyElements({ lat, lng, category, radius = DEFAULT_RADIUS_M }) {
  const key = cacheKey(category, radius, lat, lng);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.elements;
  }

  const query = buildQuery(category, radius, lat, lng);
  const data = await fetchOverpassWithFallback(query);
  const elements = data.elements || [];

  cache.set(key, { elements, time: Date.now() });
  return elements;
}
