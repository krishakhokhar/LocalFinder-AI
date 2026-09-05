import {
  VALID_CATEGORIES,
  MIN_RADIUS_M,
  MAX_RADIUS_M,
  DEFAULT_RADIUS_M,
  getNearbyElements,
} from "../utils/overpass.js";

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

  try {
    const elements = await getNearbyElements({ lat, lng, category, radius });
    return res.status(200).json({ success: true, elements });
  } catch (err) {
    console.warn("[services/nearby] failed:", err.message);
    return res.status(502).json({
      success: false,
      message: "Could not fetch nearby services from Overpass right now",
      elements: [],
    });
  }
};
