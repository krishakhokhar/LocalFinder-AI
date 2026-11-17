import api from "./apiClient";

export const reviewApi = {
  listForPlace: (placeId, params, options) =>
    api.get(`/api/reviews/place/${encodeURIComponent(placeId)}`, { ...options, params }),
  canReview: (placeId, options) =>
    api.get(`/api/reviews/place/${encodeURIComponent(placeId)}/can-review`, options),
  summaries: (placeIds, options) =>
    api.get("/api/reviews/summary", { ...options, params: { placeIds: placeIds.join(",") }, auth: false }),

  mine: (options) => api.get("/api/reviews/mine", options),
  create: (payload) => api.post("/api/reviews", payload),
  update: (id, payload) => api.patch(`/api/reviews/${id}`, payload),
  remove: (id) => api.delete(`/api/reviews/${id}`),
  report: (id, payload) => api.post(`/api/reviews/${id}/report`, payload),
};

export default reviewApi;
