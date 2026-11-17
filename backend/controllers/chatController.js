import { runAiSearch } from "../services/aiService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * POST /api/chat - the original chatbot endpoint.
 *
 * Kept so anything built against the old API keeps working, but the
 * keyword-matching implementation is gone: this now delegates to the same
 * grounded pipeline as /api/ai/search and simply reshapes the answer into
 * the legacy `{ reply, services }` envelope.
 *
 * New clients should call POST /api/ai/search, which returns the full
 * result objects, the extracted intent and search metadata.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { message, lat, lng, history, tz } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ success: false, reply: "Please enter a message.", services: [] });
  }

  const outcome = await runAiSearch({
    message: message.slice(0, 500),
    lat: typeof lat === "number" ? lat : undefined,
    lng: typeof lng === "number" ? lng : undefined,
    history: Array.isArray(history) ? history.slice(-6) : [],
    tzOffsetMinutes: typeof tz === "number" ? tz : 0,
    limit: 5,
  });

  return res.status(200).json({
    success: true,
    reply: outcome.reply,
    // Legacy field names, with real values only - `rating` is null when
    // nobody has reviewed the place rather than a generated number.
    services: outcome.results.map((place) => ({
      name: place.name,
      rating: place.rating,
      ratingCount: place.ratingCount,
      distance: place.distance,
      position: [place.lat, place.lng],
      placeId: place.placeId,
      category: place.osmType || place.category,
      openNow: place.openNow,
      phone: place.phone,
      address: place.address,
    })),
  });
});

export default sendMessage;
