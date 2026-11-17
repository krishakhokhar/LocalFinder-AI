import { labelForCategory } from "../config/categories.js";

/**
 * Renders one search result as a single line of ground truth for the model.
 *
 * Every unknown is spelled out as "not listed" rather than omitted.
 * Leaving a field out invites the model to fill the gap; stating the gap
 * explicitly gives it the correct thing to say instead.
 */
export function formatPlaceLine(place) {
  const parts = [`"${place.name}"`];

  parts.push(labelForCategory(place.osmType || place.category));

  parts.push(place.distance ? `${place.distance} away` : "distance not listed");

  parts.push(
    place.rating
      ? `rated ${place.rating}/5 from ${place.ratingCount} review${place.ratingCount === 1 ? "" : "s"}`
      : "no ratings yet"
  );

  if (typeof place.priceFrom === "number") {
    parts.push(`services from ${place.priceFrom} ${place.currency || "INR"}`);
  } else {
    parts.push("prices not listed");
  }

  parts.push(
    place.openNow === true
      ? "open right now"
      : place.openNow === false
        ? "closed right now"
        : "opening hours not listed"
  );

  parts.push(place.phone ? "phone available" : "phone not listed");
  if (place.address) parts.push(`at ${place.address}`);
  if (place.verified) parts.push("verified on LocalFinder");
  if (place.acceptsBookings) parts.push("takes online bookings");

  return parts.join("; ");
}

export default formatPlaceLine;
