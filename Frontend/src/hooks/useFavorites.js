import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import favoritesApi from "../services/favoritesApi";
import { useAuth } from "../context/AuthContext";

/**
 * Shared favourites state.
 *
 * Toggling is optimistic: the heart fills immediately and rolls back if the
 * server rejects it, because waiting ~300ms for a round trip to colour an
 * icon feels broken. Signed-out users get a prompt instead of a silent
 * no-op.
 */
export function useFavorites() {
  const { isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(() => new Set());

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setFavorites([]);
      setLoaded(true);
      return;
    }
    try {
      const data = await favoritesApi.list();
      setFavorites(data.favorites || []);
    } catch {
      // Favourites are an enhancement; a failure here must not block the page.
    } finally {
      setLoaded(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setLoaded(false);
    refresh();
  }, [refresh]);

  const favoriteByPlaceId = useMemo(() => {
    const map = new Map();
    favorites.forEach((favorite) => map.set(favorite.placeId, favorite));
    return map;
  }, [favorites]);

  const isFavorite = useCallback((placeId) => favoriteByPlaceId.has(placeId), [favoriteByPlaceId]);

  const toggleFavorite = useCallback(
    async (place) => {
      if (!isAuthenticated) {
        toast.info("Sign in to save places you like");
        return { requiresAuth: true };
      }
      if (!place?.placeId) return { error: true };

      const existing = favoriteByPlaceId.get(place.placeId);
      setPending((previous) => new Set(previous).add(place.placeId));

      try {
        if (existing) {
          setFavorites((previous) => previous.filter((item) => item.placeId !== place.placeId));
          await favoritesApi.remove(existing._id);
          toast.success("Removed from saved places");
          return { removed: true };
        }

        // Optimistic insert, replaced by the server's record on success.
        const optimistic = {
          _id: `optimistic-${place.placeId}`,
          placeId: place.placeId,
          name: place.name,
          category: place.category,
          lat: place.lat,
          lng: place.lng,
          address: place.address || null,
          phone: place.phone || null,
          rating: place.rating ?? null,
          ratingCount: place.ratingCount ?? 0,
        };
        setFavorites((previous) => [optimistic, ...previous]);

        const data = await favoritesApi.add({
          placeId: place.placeId,
          name: place.name,
          category: place.category,
          lat: place.lat,
          lng: place.lng,
          address: place.address || undefined,
          phone: place.phone || undefined,
          opening_hours: place.openingHoursRaw || undefined,
        });

        setFavorites((previous) =>
          previous.map((item) => (item._id === optimistic._id ? data.favorite : item))
        );
        toast.success("Saved to your places");
        return { added: true };
      } catch (error) {
        await refresh();
        toast.error(error.message || "Could not update your saved places");
        return { error: true };
      } finally {
        setPending((previous) => {
          const next = new Set(previous);
          next.delete(place.placeId);
          return next;
        });
      }
    },
    [isAuthenticated, favoriteByPlaceId, refresh]
  );

  const removeFavorite = useCallback(
    async (id) => {
      const snapshot = favorites;
      setFavorites((previous) => previous.filter((item) => item._id !== id));
      try {
        await favoritesApi.remove(id);
        toast.success("Removed from saved places");
      } catch (error) {
        setFavorites(snapshot);
        toast.error(error.message || "Could not remove that place");
      }
    },
    [favorites]
  );

  return {
    favorites,
    loaded,
    isLoggedIn: isAuthenticated,
    favoriteByPlaceId,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    refresh,
    isPending: (placeId) => pending.has(placeId),
  };
}

export default useFavorites;
