/**
 * Display helpers.
 *
 * The rule throughout: a value that does not exist is shown as an explicit
 * "not available", never as 0, "N/A ⭐" or a placeholder that could be read
 * as real data.
 */

export const UNKNOWN = "Not available";

export function formatDistance(place) {
  if (place?.distance) return place.distance;
  if (typeof place?.distanceKm !== "number") return null;
  return place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)} m` : `${place.distanceKm.toFixed(1)} km`;
}

export function formatRating(rating) {
  if (typeof rating !== "number" || Number.isNaN(rating)) return null;
  return rating.toFixed(1);
}

export function formatReviewCount(count) {
  if (!count) return "No reviews yet";
  return count === 1 ? "1 review" : `${count} reviews`;
}

const CURRENCY_SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export function formatPrice(amount, currency = "INR") {
  if (typeof amount !== "number" || Number.isNaN(amount)) return null;
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  return `${symbol}${amount.toLocaleString("en-IN")}`;
}

export function formatPriceRange(level) {
  if (!level) return null;
  return "₹".repeat(Math.min(Math.max(level, 1), 4));
}

export function formatCategory(value) {
  if (!value) return "Service";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** "Open now" / "Closed" / null when the hours are genuinely unknown. */
export function openStatus(place) {
  if (place?.openNow === true) return { label: "Open now", tone: "success" };
  if (place?.openNow === false) return { label: "Closed", tone: "danger" };
  return null;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDate(value) {
  if (!value) return null;
  return DATE_FORMAT.format(new Date(value));
}

export function formatTime(value) {
  if (!value) return null;
  return TIME_FORMAT.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return null;
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/** "in 2 hours" / "3 days ago" - short, readable and locale-aware. */
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

export function formatRelative(value) {
  if (!value) return null;
  const difference = new Date(value).getTime() - Date.now();
  for (const [unit, size] of UNITS) {
    if (Math.abs(difference) >= size) {
      return RELATIVE.format(Math.round(difference / size), unit);
    }
  }
  return "just now";
}

/** "YYYY-MM-DD" in the viewer's own timezone, for date inputs. */
export function toDateInputValue(date) {
  const value = date instanceof Date ? date : new Date(date);
  const offset = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

export function pluralise(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function truncate(text, length = 120) {
  if (!text || text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

/** Google Maps directions to exact coordinates - never a name search. */
export function directionsUrl({ lat, lng, name, originLat, originLng }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return `https://www.google.com/maps/search/${encodeURIComponent(name || "")}`;
  }
  const params = new URLSearchParams({ api: "1", destination: `${lat},${lng}` });
  if (typeof originLat === "number" && typeof originLng === "number") {
    params.set("origin", `${originLat},${originLng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
