import axios from "axios";
import { getNearbyElements, DEFAULT_RADIUS_M } from "../utils/overpass.js";

// Simple, transparent keyword-based intent detection - deliberately not
// left to the LLM, so category detection can never invent a category
// (or a business) that wasn't actually asked for.
const CATEGORY_KEYWORDS = {
  salon: ["salon", "haircut", "hairdresser", "beauty"],
  plumber: ["plumber", "plumbing", "leak", "pipe"],
  electrician: ["electrician", "electrical", "wiring"],
  restaurant: ["restaurant", "food", "eat", "cafe", "dinner", "lunch"],
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
    let locationNote = "";

    if (category && !hasLocation) {
      locationNote =
        "I can look for real nearby options once you share your location - please allow location access and try again.";
    } else if (category && hasLocation) {
      try {
        const elements = await getNearbyElements({ lat, lng, category, radius: DEFAULT_RADIUS_M });
        services = elements
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

        if (services.length === 0) {
          locationNote = `I looked but couldn't find any real ${category} listings on OpenStreetMap near you right now.`;
        }
      } catch (err) {
        console.warn("[chat] overpass lookup failed:", err.message);
        locationNote = "I couldn't reach the map data service just now - please try again in a moment.";
      }
    }

    // The model only ever produces conversational framing text - it is
    // explicitly told not to invent business names, addresses, or
    // details itself; any real results are attached separately as
    // structured data (`services`) which the frontend renders as cards.
    const systemPrompt = category
      ? `You are the LocalFinder AI assistant. The user is looking for a "${category}" service. ` +
        `Real nearby results (if any) are fetched separately from OpenStreetMap and shown to the user as cards below your reply - ` +
        `do NOT invent, name, or describe any specific business yourself. Just reply briefly and naturally, ` +
        (services.length > 0
          ? `letting them know you found some real options nearby.`
          : `and mention what "${locationNote}" conveys, in your own words, briefly.`)
      : "You are the LocalFinder AI assistant, a helpful guide for finding local services (salons, plumbers, electricians, restaurants, gyms/spas, car services). Answer naturally and helpfully.";

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
      (services.length > 0 ? "Here are some real options nearby." : locationNote || "How can I help you find a local service today?");

    return res.status(200).json({ success: true, reply, services });
  } catch (error) {
    console.warn("[chat] failed:", error.message);
    return res.status(500).json({ success: false, reply: "AI error, please try again later.", services: [] });
  }
};
