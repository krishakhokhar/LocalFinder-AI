import api from "./apiClient";

export const authApi = {
  register: (payload) => api.post("/api/auth/register", payload, { auth: false }),
  login: (payload) => api.post("/api/auth/login", payload, { auth: false }),
  me: (options) => api.get("/api/auth/me", options),
  updateProfile: (payload) => api.patch("/api/auth/me", payload),
  changePassword: (payload) => api.post("/api/auth/change-password", payload),
  becomeOwner: (payload) => api.post("/api/auth/become-owner", payload),
};

export default authApi;
