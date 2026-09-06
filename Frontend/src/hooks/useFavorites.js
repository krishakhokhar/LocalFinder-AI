import { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE_URL } from "../config/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Shared favorites state/actions used by the Services pages and the
 * My Favorites page, so the "is this favorited" list and add/remove
 * logic lives in exactly one place.
 */
export function useFavorites() {
  const isLoggedIn = !!localStorage.getItem("token");
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      setFavorites([]);
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/favorites`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setFavorites(data.favorites);
    } catch {
      // silent - favorites are a nice-to-have, not core functionality
    }
    setLoaded(true);
  }, [isLoggedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const favoriteByPlaceId = useMemo(() => {
    const map = new Map();
    favorites.forEach((f) => map.set(f.placeId, f));
    return map;
  }, [favorites]);

  const addFavorite = useCallback(async (service) => {
    const res = await fetch(`${API_BASE_URL}/api/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(service),
    });
    const data = await res.json();
    if (data.success) setFavorites((prev) => [data.favorite, ...prev]);
    return data;
  }, []);

  const removeFavorite = useCallback(async (id) => {
    const res = await fetch(`${API_BASE_URL}/api/favorites/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (data.success) setFavorites((prev) => prev.filter((f) => f._id !== id));
    return data;
  }, []);

  return { favorites, loaded, isLoggedIn, favoriteByPlaceId, addFavorite, removeFavorite, refresh };
}
