import api from "./apiClient";

const tz = () => -new Date().getTimezoneOffset();

export const bookingApi = {
  availability: ({ businessId, serviceId, date }, options) =>
    api.get("/api/bookings/availability", {
      ...options,
      auth: false,
      params: { businessId, serviceId, date, tz: tz() },
    }),

  create: (payload) => api.post("/api/bookings", { ...payload, tz: tz() }),
  mine: (scope = "upcoming", options) => api.get("/api/bookings/mine", { ...options, params: { scope } }),
  cancel: (id, reason) => api.post(`/api/bookings/${id}/cancel`, { reason }),
  reschedule: (id, startAt) => api.post(`/api/bookings/${id}/reschedule`, { startAt, tz: tz() }),

  forBusiness: (businessId, params, options) =>
    api.get(`/api/bookings/business/${businessId}`, { ...options, params }),
  setStatus: (id, status, note) => api.patch(`/api/bookings/${id}/status`, { status, note }),
};

export default bookingApi;
