import axios from "axios";

/**
 * OSM tag selectors per product category.
 *
 * Each category owns a list of selectors rather than one, because the real
 * tagging for a category is rarely a single key: a gym is `leisure`, a spa
 * can be `leisure` *or* `amenity`, and a car wash is `amenity` while a
 * garage is `shop`. Squeezing those into one regex (as this previously did)
 * silently dropped most of the matching places.
 *
 * `["name"]` is required throughout: an unnamed node is a map feature, not
 * a business anyone can be sent to.
 *
 * Every selector is anchored (`^(...)$`). Unanchored regexes match
 * substrings, so `~"car"` also matched `car_wash`, `caravan_site` and
 * `carpet`, which is part of how unrelated places leaked into results.
 */
/**
 * Selectors are split by COST, not by importance.
 *
 * A union query costs as much as its slowest branch, and on Overpass the
 * slowest branch is whichever one matches nothing: proving absence means
 * scanning far more index than finding hits. Measured at 5 km:
 *
 *   shop~hairdresser|beauty                 2 hits    4.3s
 *   amenity=beauty_salon                    0 hits   19.1s   <- same query
 *   leisure~fitness_centre|sports_centre|…  11 hits   4.3s
 *   shop=massage                            0 hits   25.7s   <- same query
 *
 * Putting both in one union made Salon cost 19s and Spa 26s, which no
 * sensible timeout survives - so every mirror "timed out", the search fell
 * through to the weaker provider, and the category reported zero results.
 *
 * `primary` holds the mainstream tag for each category: it answers quickly
 * and carries essentially all the real data. `extended` holds the rare
 * spellings, which are only worth asking for when `primary` found nothing
 * and there is budget left to spend.
 */
export const CATEGORY_TAG_SELECTORS = {
  salon: {
    primary: ['["shop"~"^(hairdresser|beauty|barber)$"]["name"]'],
    extended: ['["amenity"="beauty_salon"]["name"]'],
  },
  restaurant: {
    primary: ['["amenity"~"^(restaurant|cafe|fast_food|food_court)$"]["name"]'],
    extended: [],
  },
  spa: {
    primary: ['["leisure"~"^(fitness_centre|sports_centre|fitness_station|spa)$"]["name"]'],
    extended: ['["amenity"="spa"]["name"]', '["shop"="massage"]["name"]'],
  },
  // Retail is densely mapped, so one union of shop values is both fast and
  // high-yield; the marketplace tag is rarer and goes in the slow tier.
  shopping: {
    primary: ['["shop"~"^(supermarket|convenience|department_store|mall|general|greengrocer)$"]["name"]'],
    extended: ['["amenity"="marketplace"]["name"]'],
  },
  // No mainstream alternative exists for a trade: craft=* is the tag, and
  // it is barely used, so this stays inherently slow where none are mapped.
  electrician: {
    primary: ['["craft"="electrician"]["name"]'],
    extended: ['["shop"="electrical"]["name"]'],
  },
  car: {
    primary: ['["shop"~"^(car_repair|tyres|car_parts|car)$"]["name"]'],
    // Fuel stations are included here as the user asked, but kept in the
    // slow tier: they are a different kind of place from a garage and
    // should not dominate a "Car Service" list.
    extended: ['["amenity"~"^(car_wash|fuel)$"]["name"]'],
  },
  health: {
    primary: ['["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]["name"]'],
    extended: ['["healthcare"~"^(hospital|clinic|doctor|pharmacy)$"]["name"]'],
  },
};

/**
 * "All" is exactly the union of the selectable categories - nothing more.
 *
 * It used to pull in banks and fuel stations too, which no filter could
 * then narrow to, so those results were unreachable clutter on the map.
 */
/**
 * Categories left out of the "All" union.
 *
 * `craft=electrician` is barely used in OpenStreetMap, and a branch that
 * matches nothing is the expensive kind - 21s on its own. Unioned into
 * "All" it would set the price of the default view, which is how the
 * busiest query on the site became the slowest. Picking the Electrician
 * category still searches it properly; it is only excluded from the
 * catch-all.
 */
const EXCLUDED_FROM_ALL = ["electrician"];

// Primary selectors only: "All" must stay fast, and the rare spellings add
// nothing to a query that is already unioning every mainstream tag.
const ALL_TAG_GROUPS = Object.entries(CATEGORY_TAG_SELECTORS)
  .filter(([key]) => !EXCLUDED_FROM_ALL.includes(key))
  .flatMap(([, entry]) => entry.primary);

export const VALID_CATEGORIES = ["all", ...Object.keys(CATEGORY_TAG_SELECTORS)];

// Multiple independently-operated public mirrors. The free Overpass API
// is known to rate-limit or reject traffic from cloud/datacenter IP
// ranges (which is exactly what a Render-hosted backend is), so a
// single mirror - or even several - is not guaranteed reliable.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Identifies this app to OSM infrastructure, as their usage policies
// require/expect. A bare axios default User-Agent is one of the things
// that gets automated traffic deprioritized or blocked outright.
const APP_USER_AGENT = "LocalFinder-AI/1.0 (+https://github.com/krishakhokhar/LocalFinder-AI)";

// A mirror gets a generous individual timeout, because "slow" and "dead"
// are not the same thing and a mirror that answers in 4s is still useful.
// What keeps the *overall* search fast is hedging (below), not a tight
// per-mirror cut-off: previously a 5s cap applied strictly sequentially
// meant two unreachable mirrors could consume the entire search budget
// before a healthy mirror further down the list was ever contacted.
// Measured: a responsive mirror answers the widest "all" query in ~2.5-3.5s.
// 4.5s therefore separates "busy but working" from "unreachable from this
// network" while freeing the concurrency slot quickly when it is the latter.
const PER_MIRROR_TIMEOUT_MS = 4500;

/**
 * Timeout for the second, patient attempt.
 *
 * Overpass answers a query that MATCHES something in 1-5s, but a query that
 * matches NOTHING has to prove absence, which means scanning far more of the
 * index. Measured against one mirror for a 5 km radius:
 *
 *   shop~hairdresser|beauty      2 hits    4.3s
 *   amenity=beauty_salon         0 hits   19.1s
 *   craft=plumber                0 hits   24.8s
 *   amenity=car_wash             0 hits   24.1s
 *
 * A union query costs as much as its slowest branch, so one rare tag made a
 * whole category unanswerable inside the fast timeout. Every mirror then
 * reported "timeout", the search fell through to the weaker fallback, and a
 * sparse category came back as a confident zero. Categories like Plumber
 * have no common tag to fall back on, so the fix cannot be to drop the rare
 * tags - it has to be to wait longer, but only when the quick attempt has
 * already failed.
 */
const SLOW_PASS_TIMEOUT_MS = 22000;

// If the mirror currently being tried has not answered within this long,
// start the next one *alongside* it rather than waiting it out. The first
// valid response wins and the losers are aborted immediately.
//
// This is deliberately a hedge, not a broadcast: at most MAX_IN_FLIGHT
// requests exist at once, and in the steady state (health data warm) only
// one is ever sent, so Overpass usage stays well within policy.
const HEDGE_DELAY_MS = 1500;
const MAX_IN_FLIGHT = 3;

// A mirror that fails gets benched for a while, with exponential backoff,
// so a network that simply cannot reach a given host stops paying its
// timeout on every single search. This also reduces load on mirrors that
// are rejecting us, which is what their rate limits are asking for.
const MIRROR_COOLDOWN_BASE_MS = 60 * 1000;
const MIRROR_COOLDOWN_MAX_MS = 15 * 60 * 1000;

// How long a past success keeps earning a mirror a second chance.
const RECENT_SUCCESS_MS = 10 * 60 * 1000;

// Used when a caller gives no explicit deadline.
const DEFAULT_OVERPASS_BUDGET_MS = 12000;

export const MIN_RADIUS_M = 100;
export const MAX_RADIUS_M = 20000;
export const DEFAULT_RADIUS_M = 3000;

// "All" now unions nine selectors, so the old cap of 30 could be filled by
// restaurants alone before a single gym was returned. Overpass applies the
// cap across the whole union, not per clause.
const RESULT_CAP = 120;

// ---------------------------------------------------------------------------
// Per-mirror health. Process-local and intentionally simple: it only needs to
// stop us re-paying the same timeouts within one server's lifetime.
// ---------------------------------------------------------------------------

const mirrorHealth = new Map();

function healthFor(url) {
  let entry = mirrorHealth.get(url);
  if (!entry) {
    entry = { failUntil: 0, consecutiveFailures: 0, lastLatencyMs: null, lastOkAt: 0 };
    mirrorHealth.set(url, entry);
  }
  return entry;
}

function recordMirrorSuccess(url, latencyMs) {
  const entry = healthFor(url);
  entry.consecutiveFailures = 0;
  entry.failUntil = 0;
  entry.lastLatencyMs = latencyMs;
  entry.lastOkAt = Date.now();
}

function recordMirrorFailure(url) {
  const entry = healthFor(url);
  entry.consecutiveFailures += 1;

  // A mirror that served us recently has earned the benefit of the doubt:
  // one timeout on a heavy query is not evidence that the host is down,
  // and benching it there would throw away the fastest known mirror over
  // a single slow request. An unproven mirror is benched immediately.
  const servedRecently = Date.now() - entry.lastOkAt < RECENT_SUCCESS_MS;
  const strikesAllowed = servedRecently ? 2 : 1;
  if (entry.consecutiveFailures < strikesAllowed) return;

  const backoff = Math.min(
    MIRROR_COOLDOWN_BASE_MS * 2 ** (entry.consecutiveFailures - strikesAllowed),
    MIRROR_COOLDOWN_MAX_MS
  );
  entry.failUntil = Date.now() + backoff;
}

/**
 * Mirrors in the order worth trying right now: not-benched first, fastest
 * known response first within that, then benched ones as a last resort
 * (better to try a benched mirror than to give up and return nothing).
 */
export function orderMirrors(preferred = null) {
  const now = Date.now();
  const ranked = OVERPASS_MIRRORS.map((url, index) => {
    const entry = healthFor(url);
    return {
      url,
      benched: entry.failUntil > now,
      // A mirror that has actually served us outranks one we have never
      // reached, however promising the latter looks on paper. Without this
      // an untried mirror would be raced ahead of a known-good one and we
      // would pay its hedge delay on every search.
      proven: entry.lastLatencyMs !== null,
      latency: entry.lastLatencyMs ?? Number.POSITIVE_INFINITY,
      index,
    };
  });

  ranked.sort((a, b) => {
    if (a.benched !== b.benched) return a.benched ? 1 : -1;
    if (a.proven !== b.proven) return a.proven ? -1 : 1;
    if (a.latency !== b.latency) return a.latency - b.latency;
    return a.index - b.index;
  });

  const urls = ranked.map((item) => item.url);
  if (!preferred) return urls;
  return [preferred, ...urls.filter((url) => url !== preferred)];
}

/** Diagnostic snapshot, surfaced by the debug endpoint. */
export function mirrorHealthSnapshot() {
  const now = Date.now();
  return OVERPASS_MIRRORS.map((url) => {
    const entry = healthFor(url);
    return {
      url,
      benched: entry.failUntil > now,
      benchedForMs: Math.max(0, entry.failUntil - now),
      consecutiveFailures: entry.consecutiveFailures,
      lastLatencyMs: entry.lastLatencyMs,
      lastOkAt: entry.lastOkAt ? new Date(entry.lastOkAt).toISOString() : null,
    };
  });
}

// Short in-memory cache so repeated queries for the same area/category
// don't all hit Overpass again - this directly reduces the odds of
// tripping rate limits, and also reduces load on the Nominatim fallback.
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map();

function cacheKey(category, radius, lat, lng) {
  // Round coordinates to ~100m precision so nearby-identical queries share a cache entry.
  return `${category}:${radius}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
}

export function getCached(category, radius, lat, lng) {
  const entry = cache.get(cacheKey(category, radius, lat, lng));
  if (entry && Date.now() - entry.time < CACHE_TTL_MS) return entry.elements;
  return null;
}

export function setCached(category, radius, lat, lng, elements) {
  cache.set(cacheKey(category, radius, lat, lng), { elements, time: Date.now() });
}

// Keep the query as small as the category actually requires - a single
// tag filter and a capped result count, rather than pulling excess OSM
// data. "out center 30" is enough for a "nearby results" list while
// keeping the payload/processing Overpass has to do meaningfully smaller.
export function selectorsForCategory(category, tier = "primary") {
  if (category === "all") return tier === "primary" ? ALL_TAG_GROUPS : [];
  const entry = CATEGORY_TAG_SELECTORS[category];
  if (!entry) return [];
  return tier === "primary" ? entry.primary : entry.extended;
}

/**
 * `nwr` matches nodes, ways and relations in one clause. The previous
 * version emitted separate node/way clauses and never asked for relations
 * at all, so anything mapped as a multipolygon - which large gyms, sports
 * complexes and hospitals routinely are - was invisible.
 *
 * `out center` gives each way/relation a single representative coordinate,
 * so every element normalises to one pin regardless of its geometry.
 */
function buildQuery(category, radius, lat, lng, tier = "primary") {
  const clauses = selectorsForCategory(category, tier).map(
    (selector) => `nwr${selector}(around:${radius},${lat},${lng});`
  );
  if (clauses.length === 0) return null;

  return `
    [out:json][timeout:25];
    (
      ${clauses.join("\n      ")}
    );
    out center ${RESULT_CAP};
  `;
}

async function fetchFromMirror(
  url,
  query,
  timeoutMs = PER_MIRROR_TIMEOUT_MS,
  controller = new AbortController()
) {
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await axios.post(url, "data=" + encodeURIComponent(query), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": APP_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      // Covers 429 (rate limited), 403 (blocked), 502/503 (overloaded),
      // and anything else - move on to the next mirror, don't retry
      // the same one (a mirror that just rejected us won't accept a
      // second attempt moments later).
      throw new Error(`HTTP ${res.status}`);
    }

    if (!res.data || !Array.isArray(res.data.elements)) {
      throw new Error("Invalid/unexpected response shape");
    }

    return res.data;
  } catch (err) {
    if (err.code === "ERR_CANCELED" || err.name === "CanceledError") {
      throw new Error("timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries each Overpass mirror once, in sequence (never in parallel).
 * Returns { elements: null, mirrorUsed: null } (not a throw) if every
 * mirror fails, so callers can fall through to another provider instead
 * of treating this as fatal.
 *
 * `preferredMirror`, when given, is tried first (the rest follow in
 * their normal order as fallback). This matters for radius-expansion
 * callers: once one mirror is known to be responding, reusing it for
 * every subsequent radius attempt avoids re-scanning all 5 mirrors each
 * time, which would otherwise multiply worst-case latency by the number
 * of radius tiers.
 */
function raceMirrors(query, mirrors, deadline, log, perMirrorTimeout = PER_MIRROR_TIMEOUT_MS, maxInFlight = MAX_IN_FLIGHT) {
  return new Promise((resolve) => {
    const failures = [];
    const controllers = new Map();

    let settled = false;
    let launchIndex = 0;
    let inFlight = 0;
    let hedgeTimer = null;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      // Cancel every still-running request: the answer is already in hand,
      // so holding those connections open would only waste mirror capacity.
      for (const controller of controllers.values()) {
        try {
          controller.abort();
        } catch {
          /* already finished */
        }
      }
      controllers.clear();
      resolve(value);
    };

    const scheduleHedge = () => {
      if (settled || launchIndex >= mirrors.length) return;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      const wait = Math.max(0, Math.min(HEDGE_DELAY_MS, deadline - Date.now()));
      hedgeTimer = setTimeout(launchNext, wait);
    };

    function launchNext() {
      if (settled) return;

      if (launchIndex >= mirrors.length || Date.now() >= deadline) {
        // Nothing left to start. Whoever is still in flight decides it.
        if (inFlight === 0) {
          if (Date.now() >= deadline && launchIndex < mirrors.length) {
            failures.push("(budget exhausted, remaining mirrors skipped)");
          }
          finish();
        }
        return;
      }

      if (inFlight >= maxInFlight) {
        scheduleHedge();
        return;
      }

      const url = mirrors[launchIndex++];
      const started = Date.now();
      const controller = new AbortController();
      controllers.set(url, controller);
      inFlight += 1;

      const budget = Math.max(1000, Math.min(perMirrorTimeout, deadline - started));

      fetchFromMirror(url, query, budget, controller)
        .then((data) => {
          const latency = Date.now() - started;
          recordMirrorSuccess(url, latency);
          log?.debug?.(`mirror ok ${url} in ${latency}ms (${data.elements.length} elements)`);
          settle({ elements: data.elements, mirrorUsed: url });
        })
        .catch((err) => {
          // An abort caused by another mirror winning is not that mirror's
          // fault, so it must not count against its health record.
          if (settled) return;
          recordMirrorFailure(url);
          failures.push(`${url} -> ${err.message}`);
        })
        .finally(() => {
          inFlight -= 1;
          controllers.delete(url);
          if (settled) return;
          if (launchIndex < mirrors.length && Date.now() < deadline) launchNext();
          else if (inFlight === 0) finish();
        });

      // Don't wait for this one to fail before considering the next.
      scheduleHedge();
    }

    function finish() {
      log?.warn?.("all mirrors failed:\n  " + failures.join("\n  "));
      settle(null);
    }

    launchNext();
  });
}

/**
 * Finds a mirror that is answering right now, using a query so small it is
 * effectively free (one node by id, no geometry, no area scan). Used only
 * before the slow pass, to avoid spending a 22-second attempt on a host
 * that is refusing traffic.
 *
 * Runs the probes concurrently because they are trivial, and resolves to
 * the first mirror that answers.
 */
async function probeForLiveMirror(mirrors, log = null, timeoutMs = 4000) {
  const probe = "[out:json][timeout:5];node(1);out;";

  const attempts = mirrors.map((url) =>
    fetchFromMirror(url, probe, timeoutMs).then(
      () => url,
      () => Promise.reject(new Error(url))
    )
  );

  try {
    // Promise.any resolves with the first fulfilment and ignores failures.
    const winner = await Promise.any(attempts);
    log?.debug?.(`probe: ${winner} is responding`);
    return winner;
  } catch {
    log?.warn?.("probe: no mirror responded");
    return null;
  }
}

export async function tryOverpass(category, radius, lat, lng, preferredMirror = null, deadline = null, log = null) {
  const effectiveDeadline = deadline ?? Date.now() + DEFAULT_OVERPASS_BUDGET_MS;
  const mirrors = orderMirrors(preferredMirror);
  const query = buildQuery(category, radius, lat, lng, "primary");
  if (!query) return { elements: null, mirrorUsed: null };

  // Pass 1: the mainstream tags only, hedged across mirrors on a short
  // timeout. This is the path essentially every search takes.
  const fast = await raceMirrors(query, mirrors, effectiveDeadline, log);
  if (fast) {
    // Found real places - the rare spellings would add nothing worth
    // another 20 seconds, so stop here.
    if (fast.elements.length > 0) return fast;

    // Nothing under the mainstream tags. Now the rare spellings are worth
    // asking about, if there is budget for a slow query.
    const extended = buildQuery(category, radius, lat, lng, "extended");
    const left = effectiveDeadline - Date.now();
    if (!extended || left < 8000) return fast;

    log?.debug?.(`extended tags for ${category} (${left}ms left)`);
    const more = await raceMirrors(
      extended,
      [fast.mirrorUsed, ...mirrors.filter((m) => m !== fast.mirrorUsed)],
      effectiveDeadline,
      log,
      Math.min(SLOW_PASS_TIMEOUT_MS, left - 500),
      2
    );
    return more?.elements?.length ? more : fast;
  }

  // Pass 2: one patient attempt. Reaching here means no mirror answered
  // quickly - which for a sparse category usually means the query is
  // expensive rather than the mirrors being down, so giving up now would
  // report "nothing here" on the strength of a timeout.
  const remaining = effectiveDeadline - Date.now();
  if (remaining < 6000) {
    log?.warn?.(`no budget left for a slow pass (${remaining}ms); giving up on overpass`);
    return { elements: null, mirrorUsed: null };
  }

  // Betting the patient attempt on a single mirror does not work: a host
  // can answer a trivial probe instantly and still refuse expensive
  // queries, so "is it up?" does not predict "will it answer this?".
  // The slow pass therefore hedges too, just with a long per-mirror
  // timeout and a wider stagger, and without the concurrency cap - the
  // working mirror is often well down the list and would otherwise never
  // get started before the budget ran out.
  const patientTimeout = Math.min(SLOW_PASS_TIMEOUT_MS, remaining - 500);
  log?.debug?.(`slow pass: hedging ${mirrors.length} mirrors at ${patientTimeout}ms each (category=${category})`);

  const slow = await raceMirrors(query, mirrors, effectiveDeadline, log, patientTimeout, mirrors.length);
  return slow ?? { elements: null, mirrorUsed: null };
}

// ---------------------------------------------------------------------------
// Reverse mapping: OSM tags -> the category keys this product uses.
//
// Needed because a single filter ("Spa/Gym") can match several OSM values,
// and because the "all" query returns a mixture. Each result keeps its own
// real type so a gym is never mislabelled as a spa.
// ---------------------------------------------------------------------------

const OSM_VALUE_TO_CATEGORY = {
  // salon
  hairdresser: "salon",
  beauty: "salon",
  beauty_salon: "salon",
  // food
  restaurant: "restaurant",
  cafe: "restaurant",
  fast_food: "restaurant",
  food_court: "restaurant",
  // spa & gym
  spa: "spa",
  fitness_centre: "spa",
  sports_centre: "spa",
  fitness_station: "spa",
  massage: "spa",
  // shopping & essentials
  supermarket: "shopping",
  convenience: "shopping",
  department_store: "shopping",
  mall: "shopping",
  general: "shopping",
  greengrocer: "shopping",
  marketplace: "shopping",
  // trades
  electrician: "electrician",
  electrical: "electrician",
  // car
  car_repair: "car",
  car_parts: "car",
  car_wash: "car",
  tyres: "car",
  car: "car",
  // health
  hospital: "health",
  clinic: "health",
  doctors: "health",
  doctor: "health",
  pharmacy: "health",
  // retained so older cached/registered records still classify
  bank: "finance",
  atm: "finance",
  fuel: "car",
};

/**
 * The raw OSM value that best describes an element (e.g. "fitness_centre").
 *
 * `leisure` is consulted before `amenity` because gyms and sports centres
 * frequently carry an incidental amenity tag as well; reading `amenity`
 * first would label a gym by its cafe or its parking.
 */
export function osmTypeFromTags(tags = {}) {
  const candidates = [tags.leisure, tags.craft, tags.shop, tags.amenity, tags.healthcare, tags.office];
  // Prefer a value this product actually understands over the first one present.
  const known = candidates.find((value) => value && OSM_VALUE_TO_CATEGORY[value]);
  return known || candidates.find(Boolean) || null;
}

/** Our category key for an OSM element, or "other" when it maps to nothing. */
export function categoryFromTags(tags = {}) {
  const value = osmTypeFromTags(tags);
  if (!value) return "other";
  return OSM_VALUE_TO_CATEGORY[value] || "other";
}

/** Categories that external (OSM) search can actually serve. */
export function supportsExternalSearch(category) {
  return VALID_CATEGORIES.includes(category);
}
