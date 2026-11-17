import test from "node:test";
import assert from "node:assert/strict";
import { extractIntentHeuristically } from "../services/intentService.js";

/**
 * The rule-based extractor is the floor the whole AI feature stands on:
 * it is what runs when Groq is unavailable, so it is tested on its own
 * without any network access.
 */
const cases = [
  {
    message: "Find the best restaurant under 500 near me",
    expect: { category: "restaurant", maxPrice: 500, sort: "rating" },
  },
  { message: "Show salons within 2 km", expect: { category: "salon", radiusMeters: 2000 } },
  { message: "find affordable gyms", expect: { category: "spa", wantsCheap: true } },
  { message: "I need an electrician near my location", expect: { category: "electrician", sort: "distance" } },
  { message: "closest car service centre", expect: { category: "car", sort: "distance" } },
  { message: "compare three nearby restaurants", expect: { category: "restaurant", intent: "compare" } },
  { message: "pharmacy open now", expect: { category: "health", openNow: true } },
  { message: "salon rated above 4.5", expect: { category: "salon", minRating: 4.5 } },
  { message: "restaurants within 800 m", expect: { category: "restaurant", radiusMeters: 800 } },
];

for (const { message, expect: expected } of cases) {
  test(`rules: ${message}`, () => {
    const intent = extractIntentHeuristically(message);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(intent[key], value, `${key} should be ${value}, got ${intent[key]}`);
    }
  });
}

test("rules detect Hinglish and Gujlish", () => {
  assert.equal(extractIntentHeuristically("mujhe paas me salon chahiye").language, "hi-latin");
  assert.equal(extractIntentHeuristically("najik ma saru restaurant che").language, "gu-latin");
  assert.equal(extractIntentHeuristically("salon ke paas").category, "salon");
});

test("rules detect Devanagari and Gujarati script", () => {
  assert.equal(extractIntentHeuristically("पास में salon").language, "hi");
  assert.equal(extractIntentHeuristically("નજીક salon").language, "gu");
});

test("an unrecognised request is reported as unclear, not guessed", () => {
  const intent = extractIntentHeuristically("what is the weather tomorrow");
  assert.equal(intent.category, null);
  assert.equal(intent.intent, "unclear");
});

test("a bare number is not mistaken for a budget cap on its own", () => {
  const intent = extractIntentHeuristically("salon");
  assert.equal(intent.maxPrice, null);
  assert.equal(intent.radiusMeters, null);
  assert.equal(intent.minRating, null);
});

test("a distance is never mistaken for a budget", () => {
  for (const message of [
    "Show salons within 2 km",
    "restaurants within 800 m",
    "gyms under 5 km",
    "salon less than 3 kilometers away",
    "car service within 10 minutes",
  ]) {
    assert.equal(
      extractIntentHeuristically(message).maxPrice,
      null,
      `"${message}" must not produce a budget`
    );
  }
});

test("a real budget is still detected alongside a distance", () => {
  const intent = extractIntentHeuristically("restaurants within 2 km under 500 rupees");
  assert.equal(intent.radiusMeters, 2000);
  assert.equal(intent.maxPrice, 500);
});

test("currency-marked budgets are detected", () => {
  assert.equal(extractIntentHeuristically("salon under rs 300").maxPrice, 300);
  assert.equal(extractIntentHeuristically("restaurant budget 1,200").maxPrice, 1200);
});
