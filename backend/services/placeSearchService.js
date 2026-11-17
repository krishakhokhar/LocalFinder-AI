import mongoose from "mongoose";
import Business from "../models/Business.js";
import Review from "../models/Review.js";
import { findNearbyPlacesExpanding } from "../utils/places.js";
import {
  DEFAULT_RADIUS_M,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  VALID_CATEGORIES,
  categoryFromTags,
  osmTypeFromTags,
} from "../utils/overpass.js";
import { haversineKm } from "../utils/geo.js";
import { osmPlaceId, businessPlaceId, businessIdFromPlaceId } from "../utils/placeId.js";
import { isOpenNow, describeWeek } from "../utils/openingHours.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("search");

export const SORTS = ["distance", "rating", "relevance"];

/**
 * The single source of search results for the whole product - the Explore
 * page, the AI assistant and the home page all go through here.
 *
 * Two things it guarantees:
 *
 *  1. Every field is real. A rating exists only if LocalFinder users wrote
 *     reviews for that exact place; a phone number, address or opening hour
 *     exists only if OpenStreetMap or the business owner supplied it.
 *     Anything unknown is `null`, which the UI renders as "not available".
 *     Nothing here invents, estimates or randomises a value.
 *
 *  2. Registered LocalFinder businesses and external OSM places are merged
 *     into one ranked list but stay distinguishable through `source`, so
 *     the UI can label where each result came from and attribute OSM.
 */

const WORD_SPLIT = /[^a-z0-9]+/i;

function normaliseName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\b(the|shop|store|salon|studio|centre|center|clinic|cafe|restaurant)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function distanceLabel(km) {
  if (km === null || km === undefined) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${round(km, 1)} km`;
}

/** Lowest price among a business's active, priced services - never inferred. */
function priceFrom(business) {
  const prices = (business.services || [])
    .filter((service) => service.active && typeof service.price === "number")
    .map((service) => service.price);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Converts a business's weekly table into the same shape the OSM parser emits. */
function businessWeek(business) {
  if (!Array.isArray(business.openingHours) || business.openingHours.length === 0) return null;
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const short = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return names.map((day, index) => {
    const row = business.openingHours.find((entry) => entry.day === index);
    if (!row) return { day, short: short[index], text: "Not specified" };
    return {
      day,
      short: short[index],
      text: row.closed ? "Closed" : `${row.open} - ${row.close}`,
    };
  });
}

function businessOpenNow(business, tzOffsetMinutes) {
  if (!Array.isArray(business.openingHours) || business.openingHours.length === 0) return null;
  const local = new Date(Date.now() + tzOffsetMinutes * 60 * 1000);
  const row = business.openingHours.find((entry) => entry.day === local.getUTCDay());
  if (!row) return null;
  if (row.closed) return false;
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const [openH, openM] = row.open.split(":").map(Number);
  const [closeH, closeM] = row.close.split(":").map(Number);
  const from = openH * 60 + openM;
  const to = closeH * 60 + closeM;
  return to > from ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

function normaliseBusiness(business, origin, tzOffsetMinutes) {
  const [lng, lat] = business.location?.coordinates || [];
  const km = origin ? haversineKm(origin.lat, origin.lng, lat, lng) : null;

  return {
    placeId: businessPlaceId(business._id),
    source: "localfinder",
    businessId: String(business._id),
    name: business.name,
    category: business.category,
    osmType: null,
    description: business.description || null,
    lat,
    lng,
    distanceKm: km === null ? null : round(km, 2),
    distance: distanceLabel(km),
    address:
      [business.address?.line1, business.address?.area].filter(Boolean).join(", ") || null,
    city: business.address?.city || null,
    phone: business.phone || null,
    website: business.website || null,
    openingHoursRaw: null,
    openingHours: businessWeek(business),
    openNow: businessOpenNow(business, tzOffsetMinutes),
    rating: null,
    ratingCount: 0,
    priceRange: business.priceRange ?? null,
    priceFrom: priceFrom(business),
    currency: business.services?.[0]?.currency || "INR",
    verified: Boolean(business.verified),
    acceptsBookings: Boolean(business.acceptsBookings) && (business.services || []).some((s) => s.active),
    logoUrl: business.logoUrl || null,
    images: business.gallery || [],
    servicesCount: (business.services || []).filter((service) => service.active).length,
    viewCount: business.viewCount || 0,
  };
}

function normaliseOsmElement(element, origin, tzOffsetMinutes) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number" || !tags.name) return null;

  const km = origin ? haversineKm(origin.lat, origin.lng, lat, lng) : null;
  const raw = tags.opening_hours || null;
  const street = tags["addr:street"]
    ? `${tags["addr:street"]}${tags["addr:housenumber"] ? " " + tags["addr:housenumber"] : ""}`
    : null;

  return {
    placeId: osmPlaceId(tags.name, lat, lng),
    source: "osm",
    businessId: null,
    name: tags.name,
    category: categoryFromTags(tags),
    osmType: osmTypeFromTags(tags),
    description: tags.description || null,
    lat,
    lng,
    distanceKm: km === null ? null : round(km, 2),
    distance: distanceLabel(km),
    address: street || tags["addr:full"] || null,
    city: tags["addr:city"] || null,
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    openingHoursRaw: raw,
    openingHours: describeWeek(raw),
    openNow: isOpenNow(raw, tzOffsetMinutes),
    rating: null,
    ratingCount: 0,
    // OpenStreetMap carries no pricing data. Showing a band here would be a
    // guess, so it stays unknown unless the owner registers the business.
    priceRange: null,
    priceFrom: null,
    currency: "INR",
    verified: false,
    acceptsBookings: false,
    logoUrl: null,
    images: [],
    servicesCount: 0,
    viewCount: 0,
  };
}

/**
 * Drops OSM copies of businesses that are registered with us: same-ish name
 * within 150 m. The registered record wins because it is richer and owner
 * maintained.
 */
function dedupe(registered, external) {
  const keys = registered.map((place) => ({
    name: normaliseName(place.name),
    lat: place.lat,
    lng: place.lng,
  }));

  const kept = external.filter((place) => {
    const name = normaliseName(place.name);
    return !keys.some(
      (key) =>
        key.name &&
        key.name === name &&
        haversineKm(key.lat, key.lng, place.lat, place.lng) < 0.15
    );
  });

  return [...registered, ...kept];
}

function matchesQuery(place, terms) {
  if (terms.length === 0) return true;
  const haystack = [place.name, place.category, place.osmType, place.description, place.address, place.city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function clampRadius(value) {
  const radius = Number.isFinite(value) ? value : DEFAULT_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, radius));
}

/**
 * @param {object} params
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {string} [params.category="all"]
 * @param {number} [params.radius=3000]      metres
 * @param {string} [params.query]            free-text filter
 * @param {boolean} [params.openNow]         keep only places known to be open
 * @param {number} [params.minRating]        keep only places rated >= this
 * @param {number} [params.maxPrice]         keep only places with a known price <= this
 * @param {"distance"|"rating"|"relevance"} [params.sort="distance"]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {number} [params.tzOffsetMinutes=0]
 * @param {boolean} [params.includeExternal=true]
 */
export async function searchPlaces({
  lat,
  lng,
  category = "all",
  radius = DEFAULT_RADIUS_M,
  query = "",
  openNow = false,
  minRating = 0,
  maxPrice = null,
  sort = "distance",
  page = 1,
  limit = 20,
  tzOffsetMinutes = 0,
  includeExternal = true,
} = {}) {
  const origin = { lat, lng };
  const effectiveRadius = clampRadius(radius);
  const terms = String(query || "")
    .toLowerCase()
    .split(WORD_SPLIT)
    .filter((term) => term.length > 1);

  // --- registered businesses -------------------------------------------
  const businessFilter = {
    status: "approved",
    location: {
      $nearSphere: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: effectiveRadius,
      },
    },
  };
  if (category && category !== "all") businessFilter.category = category;

  let registered = [];
  if (dbReady()) {
    try {
      const docs = await Business.find(businessFilter).limit(60).lean();
      registered = docs.map((doc) => normaliseBusiness(doc, origin, tzOffsetMinutes));
    } catch (error) {
      // A missing 2dsphere index or a transient DB issue must not take the
      // whole search down - external results are still useful on their own.
      log.error("registered business lookup failed", error.message);
    }
  }

  // --- external (OpenStreetMap) ----------------------------------------
  let external = [];
  let provider = "localfinder";
  let degraded = false;
  let degradedMessage = null;
  let radiusUsed = effectiveRadius;
  let rawElements = [];
  let timedOut = false;

  const externalCategory = VALID_CATEGORIES.includes(category) ? category : null;
  if (includeExternal && externalCategory) {
    const result = await findNearbyPlacesExpanding({
      lat,
      lng,
      category: externalCategory,
      startRadius: effectiveRadius,
    });
    rawElements = result.elements || [];
    provider = result.provider;
    degraded = Boolean(result.degraded);
    degradedMessage = result.message || null;
    timedOut = Boolean(result.timedOut);
    radiusUsed = result.radiusUsed || effectiveRadius;
    external = rawElements
      .map((element) => normaliseOsmElement(element, origin, tzOffsetMinutes))
      .filter(Boolean);
  }

  let places = dedupe(registered, external);

  // --- real ratings, in one round trip ---------------------------------
  // If this lookup fails, results go out with `rating: null` - "we don't
  // know" - rather than the search failing. It never invents a score.
  if (dbReady()) {
    try {
      const summaries = await Review.summaryForPlaceIds(places.map((place) => place.placeId));
      places = places.map((place) => {
        const summary = summaries.get(place.placeId);
        return summary ? { ...place, rating: summary.rating, ratingCount: summary.ratingCount } : place;
      });
    } catch (error) {
      log.error("rating summary lookup failed", error.message);
    }
  }

  // --- filters ----------------------------------------------------------
  const totalBeforeFilters = places.length;
  places = places.filter((place) => {
    if (place.distanceKm !== null && place.distanceKm * 1000 > radiusUsed + 50) return false;
    if (!matchesQuery(place, terms)) return false;
    // `openNow` keeps only places *known* to be open. Unknown hours are
    // excluded rather than assumed open - the filter must not mislead.
    if (openNow && place.openNow !== true) return false;
    if (minRating > 0 && (place.rating === null || place.rating < minRating)) return false;
    if (maxPrice !== null && maxPrice !== undefined) {
      if (place.priceFrom === null || place.priceFrom > maxPrice) return false;
    }
    return true;
  });

  // --- sorting ----------------------------------------------------------
  const byDistance = (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  if (sort === "rating") {
    // Unrated places sort last rather than being treated as zero-star.
    places.sort((a, b) => {
      if ((b.rating ?? -1) !== (a.rating ?? -1)) return (b.rating ?? -1) - (a.rating ?? -1);
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
      return byDistance(a, b);
    });
  } else if (sort === "relevance") {
    // Registered + verified first, then rated, then nearest.
    places.sort((a, b) => {
      const score = (place) =>
        (place.source === "localfinder" ? 2 : 0) + (place.verified ? 1 : 0) + (place.rating ? 1 : 0);
      if (score(b) !== score(a)) return score(b) - score(a);
      return byDistance(a, b);
    });
  } else {
    places.sort(byDistance);
  }

  // --- pagination -------------------------------------------------------
  const total = places.length;
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const safePage = Math.max(page, 1);
  const start = (safePage - 1) * safeLimit;
  const pageItems = places.slice(start, start + safeLimit);

  return {
    results: pageItems,
    elements: rawElements, // kept for the original /nearby response shape
    total,
    totalBeforeFilters,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
    radiusUsed,
    provider,
    registeredCount: registered.length,
    externalCount: external.length,
    degraded,
    timedOut,
    message:
      degradedMessage ||
      (timedOut
        ? "The search was cut short before it could widen further. There may be more places a little further out."
        : null),
    attribution:
      external.length > 0
        ? "Place data © OpenStreetMap contributors (ODbL)"
        : null,
  };
}

/** Looks up one place by placeId, for the details page. */
export async function getPlaceById(placeId, { origin = null, tzOffsetMinutes = 0 } = {}) {
  const businessId = businessIdFromPlaceId(placeId);
  if (!businessId) return null;

  const business = await Business.findById(businessId).lean();
  if (!business) return null;

  const place = normaliseBusiness(business, origin, tzOffsetMinutes);
  const summaries = await Review.summaryForPlaceIds([place.placeId]);
  const summary = summaries.get(place.placeId);
  return summary ? { ...place, rating: summary.rating, ratingCount: summary.ratingCount } : place;
}

/**
 * Whether Mongo is actually connected.
 *
 * Mongoose buffers commands while disconnected and only rejects after a
 * 10-second timeout, which would turn a brief database outage into a
 * 10-second hang on every search. Checking first lets the search fall
 * back to external results immediately instead.
 */
function dbReady() {
  return mongoose.connection.readyState === 1;
}
