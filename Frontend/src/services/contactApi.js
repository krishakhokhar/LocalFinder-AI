import api from "./apiClient";

export const contactApi = {
  send: (payload) => api.post("/api/contact", payload),
};

export default contactApi;
