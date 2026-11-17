const EARTH_RADIUS_KM = 6371;
const toRad = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in kilometres.
 *
 * The server computes distance for search results; this is for the few
 * places the browser has to do it itself, such as saved places measured
 * against the viewer's current position.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default haversineKm;
