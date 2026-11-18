import { groq } from "./groqClient.js";
import { extractIntent } from "./intentService.js";
import { searchPlaces } from "./placeSearchService.js";
import { geocodePlace } from "../utils/nominatim.js";
import { labelForCategory } from "../config/categories.js";
import { formatPlaceLine } from "../utils/aiFormat.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("ai");

const LANGUAGE_NAMES = { en: "English", hi: "Hindi (Hinglish is fine)", gu: "Gujarati (Gujlish is fine)" };

/**
 * The AI recommendation engine.
 *
 * Architecture, and the reason for it:
 *
 *   message -> structured intent -> REAL search -> grounded answer
 *
 * The model is used at the two ends only: to understand what was asked,
 * and to phrase an answer. It never chooses, ranks, or invents the
 * businesses in between - those come from the same search service the
 * Explore page uses. The answer is written against a numbered list of
 * results that genuinely exist, and the prompt forbids mentioning
 * anything outside it.
 *
 * That boundary is what makes the feature safe to ship: the worst a model
 * failure can do is produce a clumsy sentence about real places, or no
 * sentence at all. It cannot produce a business that does not exist.
 */

const GUARDRAILS = `You are the LocalFinder assistant. You help people choose between local businesses.

ABSOLUTE RULES - breaking any of these is a serious failure:
1. You may ONLY mention businesses from the RESULTS list given to you. Never invent, recall or guess a business name, address, phone number or price.
2. Never state a rating for a result marked "no ratings yet". Say it has no reviews yet.
3. Never invent opening hours, prices or distances. If a field is marked unknown, say it is not listed.
4. If RESULTS is empty, say plainly that nothing matched and suggest widening the search. Do not fill the gap with examples.
5. Refer to results by their exact names as written.

STYLE:
- Be brief: 2-4 short sentences, then at most 3 bullet-style recommendations.
- Lead with your single best suggestion and say WHY, using only the data given (distance, rating, number of reviews, price, open status).
- Do not repeat the whole list back; the user can already see the cards.
- Never use markdown headings or tables.`;

/** Builds the grounded RESULTS block the model is allowed to talk about. */
function resultsBlock(places) {
  if (places.length === 0) return "RESULTS: (empty - nothing matched this search)";
  return [
    "RESULTS (the only businesses you may mention):",
    ...places.map((place, index) => `${index + 1}. ${formatPlaceLine(place)}`),
  ].join("\n");
}

function contextBlock(intent, origin, originLabel, radiusUsed) {
  const requested = intent.radiusMeters || 3000;
  const lines = [`User's search area: ${originLabel}.`];

  if (radiusUsed > requested) {
    // The search ladder widens automatically when nothing is found close
    // by. Saying so matters: otherwise a result 5 km away looks like an
    // answer to "within 2 km".
    lines.push(
      `IMPORTANT: nothing was found within the ${(requested / 1000).toFixed(1)} km the user asked for, so the search widened to ${(radiusUsed / 1000).toFixed(1)} km. Say this in your first sentence.`
    );
  } else {
    lines.push(`Search radius used: ${(radiusUsed / 1000).toFixed(1)} km.`);
  }
  if (intent.category) lines.push(`Category searched: ${labelForCategory(intent.category)}.`);
  if (intent.maxPrice) lines.push(`User's budget: up to ${intent.maxPrice} rupees.`);
  if (intent.minRating) lines.push(`User asked for at least ${intent.minRating} stars.`);
  if (intent.openNow) lines.push("User asked for places open right now.");
  lines.push(`Reply in: ${LANGUAGE_NAMES[intent.language] || "English"}.`);
  return lines.join("\n");
}

/**
 * Deterministic reply used when the model is unavailable.
 *
 * Plain, factual, and built from the same real results - so the feature
 * still answers usefully with Groq switched off entirely.
 */
function fallbackReply(places, intent, relaxed = []) {
  if (places.length === 0) {
    return intent.category
      ? `I could not find any ${labelForCategory(intent.category).toLowerCase()} matching that nearby. Try widening the distance or removing a filter.`
      : "I could not find anything matching that nearby. Try naming a category, like salon, restaurant or grocery store.";
  }

  const top = places[0];
  const parts = [`Closest match: ${top.name}`];
  if (top.distance) parts.push(`about ${top.distance} away`);
  if (top.rating) parts.push(`rated ${top.rating} from ${top.ratingCount} review${top.ratingCount === 1 ? "" : "s"}`);
  else parts.push("no reviews yet on LocalFinder");

  const more = places.length > 1 ? ` I found ${places.length} options in total - they are listed below.` : "";
  const caveat =
    relaxed.length > 0
      ? ` None of these publish the information needed for your ${relaxed.join(" or ")}, so I could not filter on it.`
      : "";
  return `${caveat}${caveat ? " " : ""}${parts.join(", ")}.${more}`.trim();
}

/**
 * Resolves where to search.
 *
 * A place named in the message wins over the browser location, because
 * someone who typed "salons in Bodakdev" means Bodakdev even if they are
 * standing somewhere else.
 */
async function resolveOrigin(intent, coords) {
  if (intent.locationText) {
    const geocoded = await geocodePlace(intent.locationText);
    if (geocoded) {
      return {
        origin: { lat: geocoded.lat, lng: geocoded.lng },
        label: geocoded.label.split(",").slice(0, 2).join(",").trim(),
        resolvedFrom: "text",
      };
    }
    // Named a place we could not find: fall through to their coordinates
    // rather than silently searching the wrong city.
    if (coords) {
      return { origin: coords, label: "your current location", resolvedFrom: "device", unresolvedText: intent.locationText };
    }
    return { origin: null, label: null, resolvedFrom: "none", unresolvedText: intent.locationText };
  }

  if (coords) return { origin: coords, label: "your current location", resolvedFrom: "device" };
  return { origin: null, label: null, resolvedFrom: "none" };
}

/**
 * Main entry point for POST /api/ai/search.
 *
 * @returns {{reply:string, results:Array, intent:object, meta:object}}
 */
export async function runAiSearch({ message, lat, lng, history = [], tzOffsetMinutes = 0, limit = 6 }) {
  const coords =
    typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;

  const intent = await extractIntent(message, history);

  /* --- conversations that are not searches --------------------------- */
  if (intent.intent === "chitchat") {
    return {
      reply:
        "Hi. Tell me what you are looking for nearby — for example “a salon within 2 km”, “best biryani under ₹500” or “an electrician near me”.",
      results: [],
      intent,
      meta: { searched: false, reason: "chitchat" },
    };
  }

  if (intent.intent === "unsupported") {
    return {
      reply:
        "I can help you find and compare local businesses, but I cannot place orders or make purchases. Tell me what kind of place you are looking for and I will find it.",
      results: [],
      intent,
      meta: { searched: false, reason: "unsupported" },
    };
  }

  const { origin, label, resolvedFrom, unresolvedText } = await resolveOrigin(intent, coords);

  if (!origin) {
    return {
      reply: unresolvedText
        ? `I could not find a place called “${unresolvedText}”. Share your location, or tell me a city or area name I can look up.`
        : "I need to know where to search. Allow location access, or tell me an area — for example “salons in Navrangpura”.",
      results: [],
      intent,
      meta: { searched: false, reason: "no-location", needsLocation: true },
    };
  }

  if (!intent.category && !intent.keywords) {
    return {
      reply:
        intent.clarification ||
        "What kind of place are you after? For example a salon, restaurant, gym, grocery store, electrician or car service.",
      results: [],
      intent,
      meta: { searched: false, reason: "needs-category" },
    };
  }

  /* --- the real search ------------------------------------------------ */
  const baseQuery = {
    lat: origin.lat,
    lng: origin.lng,
    category: intent.category || "all",
    radius: intent.radiusMeters || 3000,
    query: intent.keywords || "",
    sort: intent.sort || "distance",
    page: 1,
    limit,
    tzOffsetMinutes,
  };

  let outcome = await searchPlaces({
    ...baseQuery,
    openNow: Boolean(intent.openNow),
    minRating: intent.minRating || 0,
    maxPrice: intent.maxPrice ?? null,
  });

  /**
   * Honest relaxation.
   *
   * A budget, rating or open-now filter can only match places that
   * actually publish that information - and most OpenStreetMap places
   * publish none of it. Returning an empty list would be technically
   * correct and practically useless: "no restaurants under 500 nearby"
   * reads as "there are no cheap restaurants", when the truth is "nobody
   * nearby has published a price".
   *
   * So when a filtered search finds nothing, the search is re-run without
   * those filters and the answer says, in as many words, which filter
   * could not be applied and why. The results are still real; the only
   * thing that changes is that we stop pretending missing data is a
   * negative answer.
   */
  const relaxed = [];
  const hadDataFilters = intent.maxPrice != null || intent.minRating != null || intent.openNow;

  if (outcome.results.length === 0 && !outcome.degraded && hadDataFilters) {
    const retry = await searchPlaces({ ...baseQuery, openNow: false, minRating: 0, maxPrice: null });
    if (retry.results.length > 0) {
      if (intent.maxPrice != null) relaxed.push(`budget of ${intent.maxPrice} rupees`);
      if (intent.minRating != null) relaxed.push(`minimum rating of ${intent.minRating}`);
      if (intent.openNow) relaxed.push("open-right-now filter");
      outcome = retry;
    }
  }

  if (outcome.degraded) {
    return {
      reply:
        "I could not reach live map data just now, so I have nothing real to show you. That is usually temporary — please try again in a moment.",
      results: [],
      intent,
      meta: { searched: true, degraded: true, message: outcome.message },
    };
  }

  /* --- the grounded answer -------------------------------------------- */
  const places = outcome.results;

  const relaxedNote =
    relaxed.length > 0
      ? `\n\nIMPORTANT: none of the nearby places publish the data needed for the user's ${relaxed.join(" and ")}, so that filter could not be applied. Open with one short sentence saying so plainly (for example: "None of these publish their prices, so I could not filter by budget"), then give your recommendation from the results below. Do not estimate or guess any price or rating.`
      : "";

  const messages = [
    { role: "system", content: GUARDRAILS },
    {
      role: "system",
      content: `${contextBlock(intent, origin, label, outcome.radiusUsed)}${relaxedNote}\n\n${resultsBlock(places)}`,
    },
    ...history.slice(-4).map((entry) => ({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: String(entry.content || "").slice(0, 400),
    })),
    { role: "user", content: String(message).slice(0, 500) },
  ];

  const reply = await groq.complete({ messages, temperature: 0.4, maxTokens: 400, timeout: 18000 });

  if (!reply) log.debug("model unavailable - using deterministic reply");

  return {
    reply: reply || fallbackReply(places, intent, relaxed),
    results: places,
    intent,
    meta: {
      searched: true,
      grounded: true,
      total: outcome.total,
      radiusUsed: outcome.radiusUsed,
      provider: outcome.provider,
      attribution: outcome.attribution,
      origin: { ...origin, label, resolvedFrom },
      modelUsed: Boolean(reply),
      relaxedFilters: relaxed,
    },
  };
}

/**
 * Side-by-side comparison of places the user has already been shown.
 *
 * Takes placeIds rather than names: the client passes back results it
 * actually received, which makes it impossible to ask for a comparison of
 * a business that was never in a result set.
 */
export async function runAiComparison({ places, language = "en" }) {
  if (!Array.isArray(places) || places.length < 2) {
    return { reply: "Pick at least two places to compare.", comparison: null };
  }

  const subset = places.slice(0, 4);
  const messages = [
    { role: "system", content: GUARDRAILS },
    {
      role: "system",
      content: `The user wants these compared. Compare ONLY these, using ONLY these facts. Where a fact is missing, say it is not listed - do not estimate.\n\n${resultsBlock(subset)}\n\nReply in: ${LANGUAGE_NAMES[language] || "English"}.\nGive one short paragraph per place (one sentence each), then a final line starting with "Best pick:" naming one of them and why.`,
    },
    {
      role: "user",
      content: `Compare these ${subset.length} places and tell me which to choose: ${subset.map((place) => place.name).join(", ")}.`,
    },
  ];

  const reply = await groq.complete({ messages, temperature: 0.3, maxTokens: 500, timeout: 18000 });

  if (reply) return { reply, comparison: subset.map((place) => place.placeId) };

  // Deterministic comparison: rank by rating, then distance, and say so.
  const ranked = [...subset].sort((a, b) => {
    if ((b.rating ?? -1) !== (a.rating ?? -1)) return (b.rating ?? -1) - (a.rating ?? -1);
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  });

  const lines = ranked.map((place) => `• ${formatPlaceLine(place)}`);
  lines.push(
    `Best pick: ${ranked[0].name} — ${ranked[0].rating ? `highest rated of these at ${ranked[0].rating}` : "closest of these with no ratings to separate them"}.`
  );

  return { reply: lines.join("\n"), comparison: subset.map((place) => place.placeId) };
}
