import axios from "axios";

// Nominatim is a separate OSM service (different infrastructure/operator
// policy than the Overpass mirrors), used ONLY as a last-resort fallback
// when every Overpass mirror has failed. It's a geocoding/place search
// service rather than a precise category-radius POI search, so results
// are a reasonable best-effort, not a guaranteed match for every category.
//
// Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// max ~1 request/second, must identify the application via User-Agent,
// no heavy/bulk use. Since this only runs after Overpass is exhausted,
// natural call volume stays low and compliant.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const APP_USER_AGENT = "LocalFinder-AI/1.0 (+https://github.com/krishakhokhar/LocalFinder-AI)";
const TIMEOUT_MS = 6000;

// Representative free-text search terms per category - Nominatim has no
// concept of Overpass-style tag filters, so this maps each of our
// categories to the term most likely to surface relevant OSM places.
const CATEGORY_SEARCH_TERMS = {
  salon: "hair salon",
  plumber: "plumber",
  electrician: "electrician",
  restaurant: "restaurant",
  spa: "spa",
  car: "car repair",
};

function boundingBox(lat, lng, radiusM) {
  const deltaLat = radiusM / 111320;
  const deltaLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    left: lng - deltaLng,
    right: lng + deltaLng,
    top: lat + deltaLat,
    bottom: lat - deltaLat,
  };
}

/**
 * Returns Overpass-"element"-shaped results (same {lat, lon, tags} shape
 * the frontend already knows how to render) so callers never need to
 * know which provider actually served the data. Returns [] rather than
 * throwing on any failure - this is already the fallback of last resort.
 */
export async function tryNominatim(category, radius, lat, lng) {
  const term = CATEGORY_SEARCH_TERMS[category];
  if (!term) return []; // "all" has no single representative term - skip.

  const box = boundingBox(lat, lng, radius);

  try {
    const res = await axios.get(NOMINATIM_URL, {
      params: {
        q: term,
        format: "json",
        limit: 20,
        viewbox: `${box.left},${box.top},${box.right},${box.bottom}`,
        bounded: 1,
        addressdetails: 1,
        namedetails: 1,
      },
      headers: {
        "User-Agent": APP_USER_AGENT,
        Accept: "application/json",
      },
      timeout: TIMEOUT_MS,
    });

    if (!Array.isArray(res.data)) return [];

    return res.data
      .filter((place) => place.lat && place.lon)
      .map((place) => {
        const addr = place.address || {};
        const street = [addr.road, addr.house_number].filter(Boolean).join(" ");
        return {
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
          tags: {
            name: place.namedetails?.name || place.display_name.split(",")[0],
            [category === "car" ? "shop" : category === "spa" ? "leisure" : "amenity"]: category,
            "addr:street": street || undefined,
          },
        };
      });
  } catch (err) {
    console.warn("[nominatim] fallback failed:", err.message);
    return [];
  }
}
