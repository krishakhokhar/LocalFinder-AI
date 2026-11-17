/**
 * Stable identifiers for places.
 *
 * OSM places have no identifier that survives an OSM edit, so the original
 * app derived one from `name::lat::lng`. Existing Favorite documents were
 * written with exactly that format, so it is preserved verbatim - changing
 * it would orphan every favourite users have already saved.
 *
 * Businesses registered on LocalFinder itself get a prefixed id that can
 * never collide with the OSM form.
 */

export const LF_PREFIX = "lf:";

export function osmPlaceId(name, lat, lng) {
  return `${name}::${Number(lat).toFixed(5)}::${Number(lng).toFixed(5)}`;
}

export function businessPlaceId(businessId) {
  return `${LF_PREFIX}${String(businessId)}`;
}

export function isBusinessPlaceId(placeId) {
  return typeof placeId === "string" && placeId.startsWith(LF_PREFIX);
}

/** Returns the Business _id encoded in a LocalFinder placeId, or null. */
export function businessIdFromPlaceId(placeId) {
  if (!isBusinessPlaceId(placeId)) return null;
  const id = placeId.slice(LF_PREFIX.length);
  return /^[a-f\d]{24}$/i.test(id) ? id : null;
}
