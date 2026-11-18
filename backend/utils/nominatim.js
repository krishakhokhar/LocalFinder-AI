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
  shopping: "supermarket",
  electrician: "electrician",
  restaurant: "restaurant",
  spa: "gym",
  car: "car repair",
  health: "hospital",
};

// "all" has no single representative term. Previously it was simply skipped
// and an empty array was returned, which the caller could not tell apart
// from a genuine "nothing here" - so a total Overpass outage surfaced to the
// user as "No matches in this area" on the *default* category. These terms
// are tried in order, spaced to respect Nominatim's ~1 req/s policy, and
// stop as soon as one yields results.
const ALL_SEARCH_TERMS = ["restaurant", "hair salon", "pharmacy"];

// Maps a search term back to the OSM tag a real Overpass result would carry,
// so downstream category detection behaves identically for both providers.
const TERM_TO_OSM_TAG = {
  restaurant: ["amenity", "restaurant"],
  "hair salon": ["shop", "hairdresser"],
  pharmacy: ["amenity", "pharmacy"],
  supermarket: ["shop", "supermarket"],
  electrician: ["craft", "electrician"],
  gym: ["leisure", "fitness_centre"],
  spa: ["leisure", "spa"],
  hospital: ["amenity", "hospital"],
  "car repair": ["shop", "car_repair"],
};

function osmTagForCategory(category) {
  if (category === "car") return ["shop", "car_repair"];
  if (category === "spa") return ["leisure", "spa"];
  if (category === "salon") return ["shop", "hairdresser"];
  if (category === "electrician") return ["craft", category];
  if (category === "shopping") return ["shop", "supermarket"];
  return ["amenity", category];
}

// Nominatim asks for no more than one request per second.
const MIN_REQUEST_SPACING_MS = 1100;
let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

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
 * know which provider actually served the data.
 *
 * Returns an array (possibly empty) on genuine success - including a
 * real "no matches" - and `null` only when the request itself actually
 * failed. This distinction matters: callers must be able to tell "we
 * asked and there's really nothing here" apart from "we couldn't ask at
 * all", since only the latter is an upstream failure.
 */
export async function tryNominatim(category, radius, lat, lng, deadline = null) {
  const terms =
    category === "all" ? ALL_SEARCH_TERMS : CATEGORY_SEARCH_TERMS[category] ? [CATEGORY_SEARCH_TERMS[category]] : null;

  // A category this provider genuinely cannot express. `null` means "could
  // not ask", which the caller must not report to the user as "no results".
  if (!terms) return null;

  const collected = [];
  const seen = new Set();
  let anySucceeded = false;

  for (const term of terms) {
    if (deadline && Date.now() >= deadline) break;

    const batch = await nominatimSearch(term, category, radius, lat, lng);
    if (batch === null) continue; // this term's request failed; try the next
    anySucceeded = true;

    for (const place of batch) {
      // Same place can surface under more than one term.
      const key = `${place.tags.name}|${place.lat.toFixed(5)}|${place.lon.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(place);
    }

    if (collected.length > 0) break; // enough to show; don't keep hitting the service
  }

  // Every attempt failed outright -> "could not ask", not "nothing here".
  if (!anySucceeded) return null;
  return collected;
}

/** One Nominatim call. Returns an array on success, `null` if the request failed. */
async function nominatimSearch(term, category, radius, lat, lng) {
  const box = boundingBox(lat, lng, radius);

  try {
    await throttle();
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

    if (!Array.isArray(res.data)) return null;

    return res.data
      .filter((place) => place.lat && place.lon)
      .map((place) => {
        const addr = place.address || {};
        const street = [addr.road, addr.house_number].filter(Boolean).join(" ");
        // Tag the result by the term that actually found it, so an "All"
        // search labels a restaurant as a restaurant rather than inventing
        // a bogus `amenity=all`.
        const [tagKey, tagValue] = TERM_TO_OSM_TAG[term] || osmTagForCategory(category);

        return {
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
          tags: {
            name: place.namedetails?.name || place.display_name.split(",")[0],
            [tagKey]: tagValue,
            "addr:street": street || undefined,
          },
        };
      });
  } catch (err) {
    console.warn("[nominatim] fallback failed:", err.message);
    return null;
  }
}

/**
 * Forward geocoding: turns "Bodakdev, Ahmedabad" into coordinates.
 *
 * Used when someone names a place in the AI assistant instead of using
 * their current location. Returns null rather than a guess when nothing
 * matches, so the assistant asks instead of searching the wrong city.
 *
 * Same Nominatim usage policy applies: identified User-Agent, low volume,
 * one request at a time.
 */
export async function geocodePlace(text, { countryCodes = "in" } = {}) {
  const query = String(text || "").trim();
  if (query.length < 2) return null;

  try {
    const res = await axios.get(NOMINATIM_URL, {
      params: {
        q: query,
        format: "json",
        limit: 1,
        addressdetails: 1,
        countrycodes: countryCodes,
      },
      headers: { "User-Agent": APP_USER_AGENT, Accept: "application/json" },
      timeout: TIMEOUT_MS,
    });

    const first = Array.isArray(res.data) ? res.data[0] : null;
    if (!first?.lat || !first?.lon) return null;

    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      label: first.display_name,
      type: first.type,
    };
  } catch (err) {
    console.warn("[nominatim] geocode failed:", err.message);
    return null;
  }
}
