import api from "./apiClient";

export const adminApi = {
  overview: (options) => api.get("/api/admin/overview", options),
  analytics: (days = 30, options) => api.get("/api/admin/analytics", { ...options, params: { days } }),

  businesses: (params, options) => api.get("/api/admin/businesses", { ...options, params }),
  decideBusiness: (id, decision, reason) =>
    api.post(`/api/admin/businesses/${id}/decision`, { decision, reason }),

  users: (params, options) => api.get("/api/admin/users", { ...options, params }),
  updateUser: (id, payload) => api.patch(`/api/admin/users/${id}`, payload),

  reviews: (params, options) => api.get("/api/admin/reviews", { ...options, params }),
  moderateReview: (id, payload) => api.patch(`/api/admin/reviews/${id}`, payload),

  reports: (params, options) => api.get("/api/admin/reports", { ...options, params }),
  resolveReport: (id, payload) => api.patch(`/api/admin/reports/${id}`, payload),

  contacts: (params, options) => api.get("/api/admin/contacts", { ...options, params }),
  updateContact: (id, payload) => api.patch(`/api/admin/contacts/${id}`, payload),

  categories: (options) => api.get("/api/admin/categories", options),
  createCategory: (payload) => api.post("/api/admin/categories", payload),
  updateCategory: (id, payload) => api.patch(`/api/admin/categories/${id}`, payload),
  deleteCategory: (id) => api.delete(`/api/admin/categories/${id}`),
};

export default adminApi;
