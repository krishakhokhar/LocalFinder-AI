import { getCached, setCached, tryOverpass } from "./overpass.js";
import { tryNominatim } from "./nominatim.js";

/**
 * Finds nearby places for a category, trying Overpass first (primary,
 * richer data - phone/address/opening hours) and falling back to
 * Nominatim only if every Overpass mirror failed. Never throws: on
 * total failure it returns an empty list with `degraded: true` and a
 * human-readable reason, so the endpoint can respond with 200 and a
 * useful message instead of breaking the whole Services page.
 */
export async function findNearbyPlaces({ lat, lng, category, radius }) {
  const cached = getCached(category, radius, lat, lng);
  if (cached) {
    return { elements: cached, provider: "cache", degraded: false };
  }

  const overpassElements = await tryOverpass(category, radius, lat, lng);
  if (overpassElements !== null) {
    setCached(category, radius, lat, lng, overpassElements);
    return { elements: overpassElements, provider: "overpass", degraded: false };
  }

  const nominatimElements = await tryNominatim(category, radius, lat, lng);
  if (nominatimElements.length > 0) {
    setCached(category, radius, lat, lng, nominatimElements);
    return { elements: nominatimElements, provider: "nominatim", degraded: false };
  }

  return {
    elements: [],
    provider: "none",
    degraded: true,
    message:
      "We couldn't reach live map data right now. This is usually temporary - please try again in a moment.",
  };
}
