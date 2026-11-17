/**
 * A deliberately conservative parser for the OSM `opening_hours` tag.
 *
 * The full specification is enormous (holidays, sunrise offsets, week
 * numbers, month ranges). Attempting all of it would produce confidently
 * wrong answers, so this handles only the common, unambiguous forms and
 * reports `null` - "we don't know" - for everything else. An unknown is
 * shown to users as "Hours unavailable", never as "Closed".
 *
 * Supported:
 *   24/7
 *   Mo-Fr 09:00-18:00
 *   Mo-Sa 09:00-13:00,16:00-20:00
 *   Mo,We,Fr 10:00-19:00
 *   Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off
 *   09:00-21:00                      (every day)
 * Anything else (PH, sunset, week/month selectors) -> unparseable.
 */

const DAY_INDEX = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const UNSUPPORTED = /(\bph\b|\bsh\b|sunrise|sunset|dawn|dusk|week\s|easter|\[)/i;

function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseDaySelector(selector) {
  const days = new Set();
  for (const part of selector.split(",")) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    const range = /^([a-z]{2})-([a-z]{2})$/.exec(token);
    if (range) {
      const from = DAY_INDEX[range[1]];
      const to = DAY_INDEX[range[2]];
      if (from === undefined || to === undefined) return null;
      // Day ranges wrap (e.g. Sa-Mo covers Sa, Su, Mo).
      for (let i = from; ; i = (i + 1) % 7) {
        days.add(i);
        if (i === to) break;
      }
      continue;
    }
    const single = DAY_INDEX[token];
    if (single === undefined) return null;
    days.add(single);
  }
  return days.size > 0 ? [...days] : null;
}

function parseIntervals(selector) {
  const intervals = [];
  for (const part of selector.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const range = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(token);
    if (!range) return null;
    const from = parseTime(range[1]);
    const to = parseTime(range[2]);
    if (from === null || to === null) return null;
    intervals.push([from, to]);
  }
  return intervals.length > 0 ? intervals : null;
}

/**
 * @returns {{always:boolean, rules:Array<{days:number[], intervals:number[][]}>}|null}
 *          null when the value cannot be understood with confidence.
 */
export function parseOpeningHours(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value === "24/7") return { always: true, rules: [] };
  if (UNSUPPORTED.test(value)) return null;

  const rules = [];
  for (const chunk of value.split(";")) {
    const rule = chunk.trim();
    if (!rule) continue;

    // "Su off" / "Mo-Fr closed"
    const closed = /^([A-Za-z,\-\s]+?)\s+(off|closed)$/i.exec(rule);
    if (closed) {
      const days = parseDaySelector(closed[1]);
      if (!days) return null;
      rules.push({ days, intervals: [] });
      continue;
    }

    // Times only -> applies every day.
    const timesOnly = parseIntervals(rule);
    if (timesOnly) {
      rules.push({ days: [0, 1, 2, 3, 4, 5, 6], intervals: timesOnly });
      continue;
    }

    const match = /^([A-Za-z,\-\s]+?)\s+([\d:,\-\s]+)$/.exec(rule);
    if (!match) return null;
    const days = parseDaySelector(match[1]);
    const intervals = parseIntervals(match[2]);
    if (!days || !intervals) return null;
    rules.push({ days, intervals });
  }

  return rules.length > 0 ? { always: false, rules } : null;
}

/**
 * Evaluates a parsed schedule at a given weekday/minute-of-day.
 * Intervals that cross midnight (e.g. 18:00-02:00) are resolved against the
 * previous day as well, which is how OSM intends them to be read.
 */
export function isOpenAt(parsed, weekday, minuteOfDay) {
  if (!parsed) return null;
  if (parsed.always) return true;

  const previousDay = (weekday + 6) % 7;

  for (const rule of parsed.rules) {
    for (const [from, to] of rule.intervals) {
      if (to > from) {
        if (rule.days.includes(weekday) && minuteOfDay >= from && minuteOfDay < to) return true;
      } else if (to < from) {
        if (rule.days.includes(weekday) && minuteOfDay >= from) return true;
        if (rule.days.includes(previousDay) && minuteOfDay < to) return true;
      }
    }
  }
  return false;
}

/**
 * `tzOffsetMinutes` is the viewer's offset from UTC (IST = +330). Opening
 * hours are local to the place, and users overwhelmingly search near
 * themselves, so the viewer's offset is the best available approximation -
 * far better than evaluating a shop's hours against the server's UTC clock.
 */
export function isOpenNow(raw, tzOffsetMinutes = 0, now = new Date()) {
  const parsed = parseOpeningHours(raw);
  if (!parsed) return null;
  const local = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
  return isOpenAt(parsed, local.getUTCDay(), local.getUTCHours() * 60 + local.getUTCMinutes());
}

function formatMinutes(total) {
  const hours = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Human-readable per-day schedule, or null when unparseable. */
export function describeWeek(raw) {
  const parsed = parseOpeningHours(raw);
  if (!parsed) return null;
  if (parsed.always) {
    return DAY_NAMES.map((day, index) => ({ day, short: DAY_SHORT[index], text: "Open 24 hours" }));
  }
  return DAY_NAMES.map((day, index) => {
    const applicable = parsed.rules.filter((rule) => rule.days.includes(index));
    const last = applicable[applicable.length - 1];
    if (!last || last.intervals.length === 0) {
      return { day, short: DAY_SHORT[index], text: applicable.length ? "Closed" : "Not specified" };
    }
    return {
      day,
      short: DAY_SHORT[index],
      text: last.intervals.map(([from, to]) => `${formatMinutes(from)} - ${formatMinutes(to)}`).join(", "),
    };
  });
}
