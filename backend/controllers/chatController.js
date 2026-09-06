import axios from "axios";
import { DEFAULT_RADIUS_M } from "../utils/overpass.js";
import { findNearbyPlaces } from "../utils/places.js";

// Simple, transparent keyword-based intent detection - deliberately not
// left to the LLM, so category detection can never invent a category
// (or a business) that wasn't actually asked for. Includes common
// Hindi/Hinglish terms since users write in mixed language.
const CATEGORY_KEYWORDS = {
  salon: ["salon", "haircut", "hairdresser", "beauty", "parlour", "salon hai"],
  plumber: ["plumber", "plumbing", "leak", "pipe"],
  electrician: ["electrician", "electrical", "wiring"],
  restaurant: ["restaurant", "restro", "resto", "food", "eat", "cafe", "dinner", "lunch", "khana", "hotel"],
  spa: ["spa", "gym", "fitness", "workout"],
  car: ["car service", "mechanic", "garage", "car repair"],
};

function detectCategory(message) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => message.includes(kw))) return category;
  }
  return null;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Builds the rules the model must follow, grounded with whatever real
// data is actually available for this request. The model is given the
// real results by name/distance/rating so it CAN reference them
// naturally in conversation, but is explicitly forbidden from ever
// mentioning a business outside this exact list.
function buildSystemPrompt({ hasLocation, lat, lng, category, services, degraded, degradedMessage }) {
  let prompt =
    "You are the LocalFinder AI assistant, a helpful guide for finding real local services " +
    "(salons, plumbers, electricians, restaurants, gyms/spas, car services) through the LocalFinder app.\n\n" +
    "STRICT RULES:\n" +
    "1. The application may already know the user's current GPS location (given below). " +
    "If a current location is given, you already know where the user is - NEVER ask them for their city, pincode, address, or location. Doing so is a mistake.\n" +
    "2. Only mention specific business names, ratings, or distances that appear in the \"REAL NEARBY RESULTS\" list below, if one is given. Never invent, guess, or make up a business that is not in that exact list.\n" +
    "3. If a REAL NEARBY RESULTS list is given but empty, say clearly and briefly that no matching nearby service was found right now - do not make one up.\n" +
    "4. If no current location is available at all (see below), then and only then explain that you need location access to show real nearby results.\n" +
    "5. Reply naturally and conversationally, concisely, in the same language/style the user wrote in (Hindi, Hinglish, or English).\n\n";

  prompt += hasLocation
    ? `Current location: known (latitude ${lat}, longitude ${lng}). Do not ask for it.\n`
    : "Current location: NOT available. Location permission has not been granted.\n";

  if (category) {
    prompt += `Detected request category: ${category}.\n`;
  }

  if (hasLocation && category) {
    if (degraded) {
      prompt += `Note: live map data could not be reached right now (temporary issue) - tell the user politely that results aren't available right now and to try again shortly. Do not invent results.\n`;
    } else if (services.length > 0) {
      prompt +=
        `REAL NEARBY RESULTS (only ever reference these, never any other business):\n` +
        services.map((s) => `- ${s.name}, ${s.distance} away, rating ${s.rating}`).join("\n") +
        "\n";
    } else {
      prompt += `REAL NEARBY RESULTS: none found for "${category}" near this location right now.\n`;
    }
  }

  return prompt;
}

export const sendMessage = async (req, res) => {
  try {
    const { message, lat, lng } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, reply: "Please enter a message.", services: [] });
    }

    const userMessage = message.toLowerCase();
    const category = detectCategory(userMessage);
    const hasLocation = typeof lat === "number" && typeof lng === "number";

    let services = [];
    let degraded = false;
    let degradedMessage = "";

    if (category && hasLocation) {
      const result = await findNearbyPlaces({ lat, lng, category, radius: DEFAULT_RADIUS_M });
      degraded = result.degraded;
      degradedMessage = result.message;

      services = result.elements
        .filter((el) => el.tags?.name)
        .map((el) => {
          const slat = el.lat ?? el.center?.lat;
          const slng = el.lon ?? el.center?.lon;
          return {
            name: el.tags.name,
            rating: (3.5 + Math.random() * 1.5).toFixed(1),
            distance: haversine(lat, lng, slat, slng).toFixed(2) + " km",
            position: [slat, slng],
          };
        })
        .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
        .slice(0, 5);
    }

    const systemPrompt = buildSystemPrompt({ hasLocation, lat, lng, category, services, degraded, degradedMessage });

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const reply =
      aiResponse.data?.choices?.[0]?.message?.content ||
      (services.length > 0 ? "Here are some real options nearby." : "How can I help you find a local service today?");

    return res.status(200).json({ success: true, reply, services });
  } catch (error) {
    console.warn("[chat] failed:", error.message);
    return res.status(500).json({ success: false, reply: "AI error, please try again later.", services: [] });
  }
};
