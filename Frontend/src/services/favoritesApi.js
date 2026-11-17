import api from "./apiClient";

export const favoritesApi = {
  list: (options) => api.get("/api/favorites", options),
  add: (place) => api.post("/api/favorites", place),
  remove: (id) => api.delete(`/api/favorites/${id}`),
  removeByPlaceId: (placeId) => api.post("/api/favorites/remove", { placeId }),
};

export default favoritesApi;
