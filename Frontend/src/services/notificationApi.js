import api from "./apiClient";

export const notificationApi = {
  list: (params, options) => api.get("/api/notifications", { ...options, params }),
  unreadCount: (options) => api.get("/api/notifications/unread-count", options),
  markRead: (id) => api.post(`/api/notifications/${id}/read`, {}),
  markAllRead: () => api.post("/api/notifications/read-all", {}),
  remove: (id) => api.delete(`/api/notifications/${id}`),
};

export default notificationApi;
