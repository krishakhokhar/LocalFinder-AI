import api from "./apiClient";

/**
 * Nearby search. `tz` is the viewer's UTC offset in minutes so the server
 * can evaluate opening hours in the user's local time rather than its own.
 */
export const placesApi = {
  nearby: ({ lat, lng, category = "all", radius = 3000, q = "", openNow, minRating, maxPrice, sort = "distance", page = 1, limit = 20, includeExternal }, options) =>
    api.get("/api/services/nearby", {
      ...options,
      params: {
        lat,
        lng,
        category,
        radius,
        q,
        openNow: openNow ? "true" : undefined,
        minRating: minRating || undefined,
        maxPrice: maxPrice ?? undefined,
        sort,
        page,
        limit,
        includeExternal: includeExternal === false ? "false" : undefined,
        tz: -new Date().getTimezoneOffset(),
      },
    }),

  categories: (options) => api.get("/api/services/categories", { ...options, auth: false }),
};

export default placesApi;
