import api from "./apiClient";

export const ownerApi = {
  overview: (options) => api.get("/api/owner/overview", options),
  analytics: (businessId, days = 30, options) =>
    api.get(`/api/owner/businesses/${businessId}/analytics`, { ...options, params: { days } }),
  reviews: (businessId, options) => api.get(`/api/owner/businesses/${businessId}/reviews`, options),
};

export default ownerApi;
