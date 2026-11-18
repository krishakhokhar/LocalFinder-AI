import { groq } from "./groqClient.js";
import { VALID_CATEGORIES } from "../utils/overpass.js";
import { BUILT_IN_CATEGORIES } from "../config/categories.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("intent");

export const SUPPORTED_CATEGORIES = [...new Set([...VALID_CATEGORIES, ...BUILT_IN_CATEGORIES.map((c) => c.key)])];

/* ========================================================================= *
 * Deterministic extraction
 *
 * Runs first and always. It is cheap, predictable and testable, and it is
 * what the system falls back to whenever the model is unavailable, slow
 * or returns something unusable. The model refines this - it never
 * replaces it wholesale.
 * ========================================================================= */

const CATEGORY_KEYWORDS = {
  salon: ["salon", "haircut", "hair cut", "hairdresser", "barber", "beauty", "parlour", "parlor", "grooming", "nai", "vaad", "baal"],
  shopping: [
    "shopping", "shop", "store", "supermarket", "grocery", "groceries", "kirana",
    "convenience", "mall", "department store", "market", "bazaar", "bazar",
    "provision", "general store", "daily needs", "saman", "dukan",
  ],
  electrician: ["electrician", "electrical", "wiring", "fuse", "bijli", "light theek"],
  restaurant: ["restaurant", "restro", "resto", "food", "eat", "cafe", "coffee", "dinner", "lunch", "breakfast", "khana", "bhojan", "jaman", "thali", "biryani", "pizza", "dhaba"],
  spa: ["spa", "gym", "fitness", "workout", "massage", "yoga", "wellness", "kasrat"],
  car: ["car service", "car repair", "mechanic", "garage", "car wash", "servicing", "puncture", "gaadi"],
  health: ["hospital", "clinic", "doctor", "pharmacy", "medical", "chemist", "dawa", "dava", "davakhana"],
};

/** Hindi/Gujarati/English numerals and budget phrasings. */
const PRICE_PATTERNS = [
  /(?:under|below|less than|within|upto|up to|max(?:imum)?)\s*(?:rs\.?|inr|₹)?\s*(\d[\d,]*)/i,
  /(?:rs\.?|inr|₹)\s*(\d[\d,]*)\s*(?:se kam|ke andar|ma|under|or less)/i,
  /(?:budget|cheap|affordable|sasta|sasti)\s*(?:of|around|about)?\s*(?:rs\.?|inr|₹)?\s*(\d[\d,]*)/i,
  /(?:rs\.?|inr|₹)\s*(\d[\d,]*)/i,
];

const RADIUS_PATTERN = /(?:within|under|inside|near(?:by)?|radius of|ke andar|ma)?\s*(\d+(?:\.\d+)?)\s*(km|kilometer|kilometre|kilomiter|m\b|meter|metre)/i;

const OPEN_NOW_PATTERN = /\b(open now|open right now|currently open|abhi khula|khula hai|atyare khulu)\b/i;

const RATING_PATTERN = /(?:(?:rated|rating|stars?)\s*(?:above|over|at least|min(?:imum)?)?\s*(\d(?:\.\d)?)|(\d(?:\.\d)?)\s*\+?\s*(?:stars?|rating))/i;

const BEST_PATTERN = /\b(best|top|highest rated|highly rated|good|achha|accha|saru|sauthi saru)\b/i;
const CHEAP_PATTERN = /\b(cheap|cheapest|affordable|budget|sasta|sasti|sastu)\b/i;
const NEAREST_PATTERN = /\b(nearest|closest|near me|nearby|paas|pass|najik|najdik)\b/i;
const COMPARE_PATTERN = /\b(compare|comparison|which is better|vs\.?|versus|difference between)\b/i;

/** Rough language hint, used only to ask the model to reply in kind. */
function detectLanguage(text) {
  if (/[઀-૿]/.test(text)) return "gu"; // Gujarati script
  if (/[ऀ-ॿ]/.test(text)) return "hi"; // Devanagari
  const hinglish = /\b(hai|kya|kaha|kahan|chahiye|karo|batao|mujhe|mere|paas|accha|sasta|nahi)\b/i;
  const gujlish = /\b(che|chhe|kyaa|kya|joiye|batavo|mane|maru|najik|saru|sastu)\b/i;
  if (gujlish.test(text)) return "gu-latin";
  if (hinglish.test(text)) return "hi-latin";
  return "en";
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Keyword matching on word boundaries, never bare substrings.
 *
 * Substring matching looks fine until "what is the weather tomorrow"
 * matches "eat" and the assistant confidently searches for restaurants.
 * Each keyword is compiled once into a bounded pattern; the earliest
 * match in the sentence wins, since that is usually the real subject.
 */
// A trailing (?:e?s)? lets a keyword match its plural ("salons", "gyms",
// "restaurants") without matching an unrelated longer word.
const CATEGORY_PATTERNS = Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => [
  category,
  new RegExp(`\\b(?:${keywords.map(escapeRegex).join("|")})(?:e?s)?\\b`, "i"),
]);

/** True when a single word is itself one of our category keywords. */
export function isCategoryWord(word) {
  const token = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!token) return false;
  return CATEGORY_PATTERNS.some(([, pattern]) => pattern.test(token));
}

function detectCategory(text) {
  let best = null;
  let bestIndex = Infinity;

  for (const [category, pattern] of CATEGORY_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match.index < bestIndex) {
      best = category;
      bestIndex = match.index;
    }
  }
  return best;
}

/**
 * Units that mean the number was never money.
 *
 * "within 500" is a budget; "within 2 km" is a radius, and both match the
 * same "within <number>" shape. Whatever follows the number decides, so a
 * number trailed by a distance or time unit is rejected outright.
 */
const NON_PRICE_UNIT = /^\s*(?:k\s?m|kms|kilomet(?:er|re)s?|m\b|met(?:er|re)s?|miles?|mins?|minutes?|hrs?|hours?|star|stars)/i;

// Scanned globally: "restaurants within 2 km under 500" contains a
// rejected match ("within 2 km") *before* the real one, so stopping at
// the first match of each pattern would miss the budget entirely.
const GLOBAL_PRICE_PATTERNS = PRICE_PATTERNS.map(
  (pattern) => new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)
);

function detectPrice(text) {
  for (const pattern of GLOBAL_PRICE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const trailing = text.slice(match.index + match[0].length);
      if (NON_PRICE_UNIT.test(trailing)) continue;

      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value > 0 && value <= 1000000) return value;
    }
  }
  return null;
}

function detectRadius(text) {
  const match = RADIUS_PATTERN.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2].toLowerCase();
  const metres = unit.startsWith("k") ? value * 1000 : value;
  return Math.min(Math.max(Math.round(metres), 100), 20000);
}

function detectRating(text) {
  const match = RATING_PATTERN.exec(text);
  if (!match) return null;
  const value = Number(match[1] || match[2]);
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : null;
}

/** @returns an intent built purely from rules - no model involved. */
export function extractIntentHeuristically(message) {
  const text = String(message || "").toLowerCase();

  const category = detectCategory(text);
  const maxPrice = detectPrice(text);
  const radius = detectRadius(text);
  const minRating = detectRating(text);

  let sort = "distance";
  if (BEST_PATTERN.test(text)) sort = "rating";
  else if (NEAREST_PATTERN.test(text)) sort = "distance";

  return {
    intent: COMPARE_PATTERN.test(text) ? "compare" : category ? "search" : "unclear",
    category: category || null,
    keywords: "",
    radiusMeters: radius,
    maxPrice,
    minRating,
    openNow: OPEN_NOW_PATTERN.test(text),
    sort,
    locationText: null,
    wantsCheap: CHEAP_PATTERN.test(text),
    language: detectLanguage(String(message || "")),
    source: "rules",
  };
}

/* ========================================================================= *
 * Model-assisted extraction
 * ========================================================================= */

const SYSTEM_PROMPT = `You convert a user's message into a structured local-business search for an app called LocalFinder.

Return ONLY a JSON object with these keys:
{
  "intent": "search" | "compare" | "refine" | "chitchat" | "unsupported",
  "category": one of [${SUPPORTED_CATEGORIES.join(", ")}] or null,
  "keywords": short free-text to match against business names (e.g. "biryani", "car wash"), or "",
  "radiusMeters": integer 100-20000, or null if not stated,
  "maxPrice": integer rupees, or null if not stated,
  "minRating": number 1-5, or null if not stated,
  "openNow": true only if the user asked for places open right now,
  "sort": "distance" | "rating" | "relevance",
  "locationText": a place name the user mentioned (e.g. "Bodakdev", "Navrangpura"), or null if they mean their current location,
  "compareNames": array of business names the user wants compared, or [],
  "language": "en" | "hi" | "gu" (the language to reply in; use "hi" for Hinglish, "gu" for Gujlish),
  "clarification": if the request is too vague to search, one short question to ask; otherwise null
}

Rules:
- NEVER invent business names. "compareNames" may only contain names the user typed or that appear in the conversation.
- "category" must be exactly one of the listed values, or null. Do not make up categories.
- If the user says "cheap"/"affordable" without a number, leave maxPrice null and set sort to "relevance".
- If the user asks for the "best"/"top", set sort to "rating".
- If the message is a greeting or small talk, use intent "chitchat".
- If they ask for something the app cannot do (ordering food, booking flights), use "unsupported".
- Output JSON only. No prose, no markdown fence.`;

/**
 * Does the message actually talk about money / ratings?
 *
 * Models reliably confuse "within 2 km" with a 2-rupee budget. Rather
 * than trusting the extracted number on its own, a model-supplied budget
 * is accepted only when the user's own words contain a money signal (and
 * likewise for ratings). When they do not, whatever the deterministic
 * rules found stands - usually nothing, which is the correct answer.
 */
const MONEY_SIGNAL = /(₹|\brs\.?\b|\binr\b|\brupees?\b|\bbudget\b|\bprice[ds]?\b|\bcosts?\b|\bcheap\b|\baffordable\b|\bsasta\b|\bsasti\b|\bsastu\b)/i;
const RATING_SIGNAL = /(\bstars?\b|\brating\b|\brated\b|\breviews?\b)/i;

function coerceIntent(raw, fallback, message = "") {
  if (!raw || typeof raw !== "object") return fallback;

  /**
   * Rejects out-of-range values rather than clamping them.
   *
   * Clamping is wrong here: a model that returns `maxPrice: 0` means "no
   * budget was given", and clamping that to the minimum would invent a
   * 1-rupee budget that silently filters out every result. An
   * out-of-range number is a signal that the model did not understand,
   * so the value is discarded and the rule-based result stands.
   */
  const inRange = (value, min, max) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) return null;
    return number;
  };

  // Radius is the one field where clamping is right: "within 50 km" is a
  // real intent that simply exceeds what we will search.
  const clampRadius = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return null;
    return Math.min(Math.max(Math.round(number), 100), 20000);
  };

  const modelCategory =
    typeof raw.category === "string" && SUPPORTED_CATEGORIES.includes(raw.category.toLowerCase())
      ? raw.category.toLowerCase()
      : null;

  /**
   * The rules win on category.
   *
   * A rule match means the user literally wrote a word we map to a
   * category ("gym", "salon", "grocery"), which is as certain as this
   * gets. Left to itself the model reasons by association and sends
   * "gym" to the health category, where it finds nothing. The model's
   * job here is to fill the gap when the rules found nothing at all -
   * for example turning "need milk and bread" into "shopping".
   */
  const category = fallback.category || modelCategory;

  /**
   * Keywords are a name filter, so a keyword that just restates the
   * category makes the search far too narrow: "gym" as a keyword drops
   * every fitness centre that does not have "gym" in its name. Those
   * tokens are removed; anything genuinely extra ("biryani", "car wash")
   * is kept.
   */
  const rawKeywords = typeof raw.keywords === "string" ? raw.keywords.slice(0, 80).trim() : "";
  const keywords = rawKeywords
    .split(/\s+/)
    .filter((token) => token && !isCategoryWord(token))
    .join(" ");

  return {
    intent: ["search", "compare", "refine", "chitchat", "unsupported"].includes(raw.intent)
      ? raw.intent
      : fallback.intent,
    // The rules found a category the model missed? Trust the rules - they
    // only fire on an explicit keyword in the user's own words.
    category: category || fallback.category,
    keywords,
    radiusMeters: clampRadius(raw.radiusMeters) ?? fallback.radiusMeters,
    maxPrice:
      (MONEY_SIGNAL.test(message) ? inRange(raw.maxPrice, 1, 1000000) : null) ?? fallback.maxPrice,
    minRating:
      (RATING_SIGNAL.test(message) ? inRange(raw.minRating, 1, 5) : null) ?? fallback.minRating,
    openNow: typeof raw.openNow === "boolean" ? raw.openNow : fallback.openNow,
    sort: ["distance", "rating", "relevance"].includes(raw.sort) ? raw.sort : fallback.sort,
    locationText:
      typeof raw.locationText === "string" && raw.locationText.trim().length > 1
        ? raw.locationText.trim().slice(0, 80)
        : null,
    compareNames: Array.isArray(raw.compareNames)
      ? raw.compareNames.filter((name) => typeof name === "string").slice(0, 5)
      : [],
    language: ["en", "hi", "gu"].includes(raw.language) ? raw.language : fallback.language.slice(0, 2),
    clarification:
      typeof raw.clarification === "string" && raw.clarification.trim() ? raw.clarification.trim() : null,
    wantsCheap: fallback.wantsCheap,
    source: "model",
  };
}

/**
 * Extracts a structured search intent from a natural-language message.
 *
 * Always starts from the rule-based result, then lets the model refine it.
 * If the model is unavailable or returns nonsense, the rules stand on
 * their own - the assistant never stops working because Groq is down.
 */
export async function extractIntent(message, history = []) {
  const heuristic = extractIntentHeuristically(message);

  if (!groq.isConfigured()) return heuristic;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-4).map((entry) => ({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: String(entry.content || "").slice(0, 500),
    })),
    { role: "user", content: String(message).slice(0, 500) },
  ];

  const parsed = await groq.completeJson({ messages, maxTokens: 300, timeout: 12000 });
  if (!parsed) {
    log.debug("falling back to rule-based intent");
    return heuristic;
  }

  return coerceIntent(parsed, heuristic, String(message));
}

export default extractIntent;
