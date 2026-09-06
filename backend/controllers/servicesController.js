import { VALID_CATEGORIES, MIN_RADIUS_M, MAX_RADIUS_M, DEFAULT_RADIUS_M } from "../utils/overpass.js";
import { findNearbyPlaces } from "../utils/places.js";

export const getNearbyServices = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const category = (req.query.category || req.query.type || "all").toLowerCase();
  const radius = req.query.radius !== undefined ? parseInt(req.query.radius, 10) : DEFAULT_RADIUS_M;

  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ success: false, message: "lat must be a number between -90 and 90", elements: [] });
  }
  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, message: "lng must be a number between -180 and 180", elements: [] });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
      elements: [],
    });
  }
  if (Number.isNaN(radius) || radius < MIN_RADIUS_M || radius > MAX_RADIUS_M) {
    return res.status(400).json({
      success: false,
      message: `radius must be a number between ${MIN_RADIUS_M} and ${MAX_RADIUS_M}`,
      elements: [],
    });
  }

  // findNearbyPlaces never throws - a total upstream failure comes back
  // as `degraded: true` with an empty list, not an exception, so this
  // endpoint can always answer with 200 rather than breaking the page.
  const { elements, provider, degraded, message } = await findNearbyPlaces({ lat, lng, category, radius });

  return res.status(200).json({
    success: true,
    elements,
    provider,
    ...(degraded ? { degraded: true, message } : {}),
  });
};
