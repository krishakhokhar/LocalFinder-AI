import { runAiSearch, runAiComparison } from "../services/aiService.js";
import { searchPlaces } from "../services/placeSearchService.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordEvent } from "../services/analyticsService.js";
import { groq } from "../services/groqClient.js";

/**
 * POST /api/ai/search
 *
 * Natural language in, real search results plus a grounded recommendation
 * out. The Groq key never leaves the server - the frontend only ever
 * talks to this endpoint.
 */
export const aiSearch = asyncHandler(async (req, res) => {
  const { message, lat, lng, history, tz } = req.body;

  const outcome = await runAiSearch({
    message,
    lat,
    lng,
    history,
    tzOffsetMinutes: tz ?? 0,
  });

  recordEvent({
    type: "ai_search",
    user: req.user?._id || null,
    meta: {
      category: outcome.intent?.category || null,
      hasBudget: Boolean(outcome.intent?.maxPrice),
      language: outcome.intent?.language,
      results: outcome.results.length,
      modelUsed: outcome.meta?.modelUsed ?? false,
    },
  });

  return ok(res, {
    reply: outcome.reply,
    results: outcome.results,
    intent: {
      category: outcome.intent?.category || null,
      keywords: outcome.intent?.keywords || "",
      radiusMeters: outcome.intent?.radiusMeters || null,
      maxPrice: outcome.intent?.maxPrice ?? null,
      minRating: outcome.intent?.minRating ?? null,
      openNow: Boolean(outcome.intent?.openNow),
      sort: outcome.intent?.sort || "distance",
      language: outcome.intent?.language || "en",
    },
    meta: outcome.meta,
  });
});

/**
 * POST /api/ai/compare
 *
 * Compares places the caller has already been shown. The client sends the
 * coordinates it received, and each one is re-resolved through a real
 * search before the model sees it, so a comparison can never be requested
 * for a business that does not exist.
 */
export const aiCompare = asyncHandler(async (req, res) => {
  const { placeIds, lat, lng, category, radius, language, tz } = req.body;

  if (!Array.isArray(placeIds) || placeIds.length < 2) {
    throw ApiError.badRequest("Send at least two placeIds to compare");
  }

  const outcome = await searchPlaces({
    lat,
    lng,
    category: category || "all",
    radius: radius || 5000,
    limit: 50,
    tzOffsetMinutes: tz ?? 0,
  });

  const wanted = new Set(placeIds.slice(0, 4));
  const places = outcome.results.filter((place) => wanted.has(place.placeId));

  if (places.length < 2) {
    throw ApiError.badRequest(
      "Those places are no longer in the current search results. Run the search again and retry."
    );
  }

  const comparison = await runAiComparison({ places, language });

  return ok(res, {
    reply: comparison.reply,
    compared: places,
    attribution: outcome.attribution,
  });
});

/** GET /api/ai/status - lets the UI tell the user when AI is switched off. */
export const aiStatus = asyncHandler(async (req, res) =>
  ok(res, {
    available: groq.isConfigured(),
    // Even without a key the endpoint still returns real search results
    // with a plain, deterministic summary.
    degradedMode: !groq.isConfigured(),
  })
);
