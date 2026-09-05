import axios from "axios";

// Mirrors the category tag mapping that used to live in the frontend.
// "all" is the union of every named category's tags so "All" still
// surfaces salons, plumbers, electricians, restaurants, spas and car
// services together.
const CATEGORY_TAGS = {
  salon: '["amenity"~"hairdresser|beauty"]["name"]',
  plumber: '["craft"="plumber"]["name"]',
  electrician: '["craft"="electrician"]["name"]',
  restaurant: '["amenity"~"restaurant|cafe|fast_food"]["name"]',
  spa: '["leisure"~"spa|fitness_centre"]["name"]',
  car: '["shop"~"car_repair|car"]["name"]',
};

const ALL_TAG_GROUPS = [
  '["amenity"~"hairdresser|restaurant|cafe|fast_food|hospital|pharmacy|bank|fuel"]["name"]',
  '["craft"~"plumber|electrician"]["name"]',
  '["shop"~"car_repair|car"]["name"]',
  '["leisure"~"spa|fitness_centre"]["name"]',
];

const VALID_CATEGORIES = ["all", ...Object.keys(CATEGORY_TAGS)];

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

const PER_MIRROR_TIMEOUT_MS = 12000;
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 20000;
const DEFAULT_RADIUS_M = 3000;

function buildQuery(category, radius, lat, lng) {
  const clauses =
    category === "all"
      ? ALL_TAG_GROUPS.flatMap((tag) => [
          `node${tag}(around:${radius},${lat},${lng});`,
          `way${tag}(around:${radius},${lat},${lng});`,
        ])
      : [
          `node${CATEGORY_TAGS[category]}(around:${radius},${lat},${lng});`,
          `way${CATEGORY_TAGS[category]}(around:${radius},${lat},${lng});`,
        ];

  return `
    [out:json][timeout:25];
    (
      ${clauses.join("\n      ")}
    );
    out center 60;
  `;
}

async function fetchFromMirror(url, query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_MIRROR_TIMEOUT_MS);

  try {
    const res = await axios.post(url, "data=" + encodeURIComponent(query), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      throw new Error(`Overpass mirror responded with ${res.status}`);
    }

    return res.data;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOverpassWithFallback(query) {
  let lastError;
  for (const url of OVERPASS_MIRRORS) {
    try {
      return await fetchFromMirror(url, query);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("All Overpass mirrors failed");
}

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
    const query = buildQuery(category, radius, lat, lng);
    const data = await fetchOverpassWithFallback(query);
    return res.status(200).json({ success: true, elements: data.elements || [] });
  } catch (err) {
    return res.status(502).json({
      success: false,
      message: "Could not fetch nearby services from Overpass right now",
      elements: [],
    });
  }
};
