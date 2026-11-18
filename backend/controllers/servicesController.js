import mongoose from "mongoose";
import Category from "../models/Category.js";
import { searchPlaces } from "../services/placeSearchService.js";
import { VALID_CATEGORIES, mirrorHealthSnapshot } from "../utils/overpass.js";
import { BUILT_IN_CATEGORIES } from "../config/categories.js";
import { ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordEvent } from "../services/analyticsService.js";

/**
 * GET /api/services/nearby
 *
 * The response keeps the original `elements` array so anything built
 * against the previous API still works, and adds `results`: the normalised,
 * deduplicated, really-rated list that the current UI consumes.
 *
 * This endpoint never fails because an upstream map provider is down. A
 * total outage comes back as `degraded: true` with an explanation and an
 * empty list, so the page can say what happened instead of breaking.
 */
export const getNearbyServices = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const category = query.category || query.type || "all";

  const outcome = await searchPlaces({
    lat: query.lat,
    lng: query.lng,
    category,
    radius: query.radius,
    query: query.q,
    openNow: query.openNow === true,
    minRating: query.minRating,
    maxPrice: query.maxPrice ?? null,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
    tzOffsetMinutes: query.tz,
    includeExternal: query.includeExternal !== false,
    source: query.source || "all",
    // Opt-in only: the UI asks for a wider search when the user accepts
    // the offer, so the radius never changes behind their back.
    autoExpand: query.autoExpand === true,
  });

  // Fire-and-forget: analytics must never slow down or break a search.
  recordEvent({
    type: "search",
    user: req.user?._id || null,
    meta: { category, radius: query.radius, hasQuery: Boolean(query.q), results: outcome.total },
  });

  return ok(res, {
    results: outcome.results,
    elements: outcome.elements,
    total: outcome.total,
    page: outcome.page,
    pages: outcome.pages,
    limit: outcome.limit,
    radiusUsed: outcome.radiusUsed,
    provider: outcome.provider,
    registeredCount: outcome.registeredCount,
    externalCount: outcome.externalCount,
    suggestedRadius: outcome.suggestedRadius,
    hiddenByOpenNow: outcome.hiddenByOpenNow,
    hiddenByRating: outcome.hiddenByRating,
    hiddenByPrice: outcome.hiddenByPrice,
    unknownHoursCount: outcome.unknownHoursCount,
    ratedCount: outcome.ratedCount,
    pricedCount: outcome.pricedCount,
    source: outcome.source,
    attribution: outcome.attribution,
    ...(outcome.degraded ? { degraded: true, message: outcome.message } : {}),
    ...(outcome.timedOut ? { timedOut: true, message: outcome.message } : {}),
  });
});

/**
 * GET /api/services/diagnostics
 *
 * Which Overpass mirrors are currently usable from this server, and how
 * fast each last responded. Read-only and secret-free: it exists because
 * "the Explore page shows nothing" and "every mirror is benched" look
 * identical from the browser, and telling them apart used to require
 * instrumenting the code by hand.
 */
export const getSearchDiagnostics = asyncHandler(async (req, res) => {
  const mirrors = mirrorHealthSnapshot();
  return ok(res, {
    mirrors,
    usableMirrors: mirrors.filter((mirror) => !mirror.benched).length,
    totalMirrors: mirrors.length,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

/**
 * GET /api/services/categories
 *
 * Admin-managed categories when they exist, falling back to the built-in
 * list so a fresh database still renders a working UI.
 */
export const getCategories = asyncHandler(async (req, res) => {
  let categories = [];
  // Skip the query outright when Mongo is not connected: Mongoose would
  // otherwise buffer the command and only fail after a 10s timeout, turning
  // a trivial endpoint into a 10-second hang during an outage.
  if (mongoose.connection.readyState === 1) {
    try {
      categories = await Category.find({ active: true }).sort({ order: 1, label: 1 }).lean();
    } catch {
      categories = [];
    }
  }

  if (categories.length === 0) {
    categories = BUILT_IN_CATEGORIES.map((category) => ({
      ...category,
      supportsExternalSearch: VALID_CATEGORIES.includes(category.key),
    }));
  }

  return ok(res, { categories });
});
