import api from "./apiClient";

/**
 * The AI endpoints. The Groq key lives only on the server; the browser
 * never sees it and never talks to Groq directly.
 */
export const aiApi = {
  status: (options) => api.get("/api/ai/status", { ...options, auth: false }),

  search: ({ message, lat, lng, history = [] }, options) =>
    api.post(
      "/api/ai/search",
      {
        message,
        ...(typeof lat === "number" ? { lat, lng } : {}),
        history: history.slice(-6),
        tz: -new Date().getTimezoneOffset(),
      },
      options
    ),

  compare: ({ placeIds, lat, lng, category, radius, language }, options) =>
    api.post(
      "/api/ai/compare",
      { placeIds, lat, lng, category, radius, language, tz: -new Date().getTimezoneOffset() },
      options
    ),
};

export default aiApi;
