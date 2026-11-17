import api from "./apiClient";

export const businessApi = {
  /* public */
  list: (params, options) => api.get("/api/businesses", { ...options, params }),
  get: (id, options) => api.get(`/api/businesses/${id}`, options),
  recordInteraction: (id, type) => api.post(`/api/businesses/${id}/interaction`, { type }),

  /* owner */
  mine: (options) => api.get("/api/businesses/mine", options),
  create: (payload) => api.post("/api/businesses", payload),
  update: (id, payload) => api.patch(`/api/businesses/${id}`, payload),
  remove: (id) => api.delete(`/api/businesses/${id}`),
  submit: (id) => api.post(`/api/businesses/${id}/submit`, {}),
  setHours: (id, openingHours) => api.put(`/api/businesses/${id}/hours`, { openingHours }),
  updateBookingSettings: (id, payload) => api.patch(`/api/businesses/${id}/booking-settings`, payload),

  addService: (id, payload) => api.post(`/api/businesses/${id}/services`, payload),
  updateService: (id, serviceId, payload) =>
    api.patch(`/api/businesses/${id}/services/${serviceId}`, payload),
  removeService: (id, serviceId) => api.delete(`/api/businesses/${id}/services/${serviceId}`),
};

export default businessApi;
