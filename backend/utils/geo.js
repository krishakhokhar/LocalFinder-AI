const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/** Axis-aligned bounding box around a point, for viewbox-style queries. */
export function boundingBox(lat, lng, radiusM) {
  const deltaLat = radiusM / 111320;
  const deltaLng = radiusM / (111320 * Math.cos(toRad(lat)) || 1);
  return {
    left: lng - deltaLng,
    right: lng + deltaLng,
    top: lat + deltaLat,
    bottom: lat - deltaLat,
  };
}

export function isValidLat(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLng(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

/** GeoJSON Point, the shape a 2dsphere index expects. */
export function toGeoPoint(lat, lng) {
  return { type: "Point", coordinates: [lng, lat] };
}

export function fromGeoPoint(point) {
  if (!point || !Array.isArray(point.coordinates)) return null;
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}
