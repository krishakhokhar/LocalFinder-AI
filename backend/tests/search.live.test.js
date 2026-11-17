import test from "node:test";
import assert from "node:assert/strict";

/**
 * Live integration test against the real OpenStreetMap infrastructure.
 *
 * It deliberately runs with no database connection, which also proves the
 * search degrades correctly when Mongo is unavailable: external results
 * still come back, and every rating is null rather than invented.
 *
 * Skipped unless LIVE_TESTS=1, because it depends on a third-party service
 * and must never make CI flaky.
 */
const live = process.env.LIVE_TESTS === "1";
const AHMEDABAD = { lat: 23.0225, lng: 72.5714 };

const { searchPlaces } = await import("../services/placeSearchService.js");

test("nearby restaurants come back with only real fields", { skip: !live }, async () => {
  const outcome = await searchPlaces({
    ...AHMEDABAD,
    category: "restaurant",
    radius: 2000,
    limit: 10,
    tzOffsetMinutes: 330,
  });

  assert.ok(Array.isArray(outcome.results), "results must be an array");
  if (outcome.degraded) {
    assert.equal(outcome.results.length, 0);
    assert.ok(outcome.message, "a degraded search must explain itself");
    return;
  }

  assert.ok(outcome.results.length > 0, "expected at least one restaurant in central Ahmedabad");

  for (const place of outcome.results) {
    assert.ok(place.name, "every result has a name");
    assert.equal(typeof place.lat, "number");
    assert.equal(typeof place.lng, "number");
    assert.ok(place.placeId.includes("::"), "OSM ids keep the legacy name::lat::lng format");
    assert.equal(place.source, "osm");

    // The core data-quality guarantee.
    assert.equal(place.rating, null, "no rating may exist without a review");
    assert.equal(place.ratingCount, 0);
    assert.equal(place.priceRange, null, "OSM carries no pricing");
    assert.equal(place.priceFrom, null);
    assert.ok([true, false, null].includes(place.openNow), "openNow is true, false or unknown");
    assert.ok(place.distanceKm <= 2.1, `${place.name} should be within the radius`);
  }

  // Sorted nearest-first by default.
  const distances = outcome.results.map((place) => place.distanceKm);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
  assert.match(outcome.attribution, /OpenStreetMap/);
});

test("a keyword narrows the result set", { skip: !live }, async () => {
  const all = await searchPlaces({ ...AHMEDABAD, category: "restaurant", radius: 3000, limit: 50 });
  if (all.degraded || all.results.length === 0) return;

  const term = all.results[0].name.split(/\s+/)[0].toLowerCase();
  const filtered = await searchPlaces({
    ...AHMEDABAD,
    category: "restaurant",
    radius: 3000,
    limit: 50,
    query: term,
  });

  assert.ok(filtered.total <= all.total);
  for (const place of filtered.results) {
    // Plain substring check - the term comes from real OSM data and may
    // contain regex metacharacters.
    assert.ok(
      place.name.toLowerCase().includes(term) ||
        [place.category, place.osmType, place.address, place.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      `${place.name} should match "${term}"`
    );
  }
});

test("an unknown category returns nothing rather than guessing", { skip: !live }, async () => {
  const outcome = await searchPlaces({ ...AHMEDABAD, category: "unicorn-grooming", radius: 2000 });
  assert.equal(outcome.results.length, 0);
  assert.equal(outcome.externalCount, 0);
});
