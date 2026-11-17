import { useMemo, useState } from "react";
import { Heart, MapPin, Search, SearchX } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import PageTransition from "../components/motion/PageTransition";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import { BusinessCardSkeleton } from "../components/common/Skeleton";
import { RevealGroup, RevealItem } from "../components/common/Reveal";
import BusinessCard from "../components/business/BusinessCard";
import useFavorites from "../hooks/useFavorites";
import useGeolocation from "../hooks/useGeolocation";
import { haversineKm } from "../utils/distance";
import { categoryConfig } from "../utils/categories";

/**
 * Saved places.
 *
 * Distance is computed in the browser against the viewer's current
 * position when they allow it, so a saved place shows how far away it is
 * *now* rather than how far it was when it was saved.
 */
export default function Favorites() {
  const { favorites, loaded, removeFavorite } = useFavorites();
  const { location, request, isLocating } = useGeolocation({ auto: true });
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");

  const places = useMemo(
    () =>
      favorites.map((favorite) => {
        const distanceKm = location
          ? haversineKm(location.lat, location.lng, favorite.lat, favorite.lng)
          : null;
        return {
          placeId: favorite.placeId,
          businessId: favorite.businessId || null,
          source: favorite.source || "osm",
          name: favorite.name,
          category: favorite.category || "other",
          osmType: favorite.category || null,
          lat: favorite.lat,
          lng: favorite.lng,
          address: favorite.address,
          phone: favorite.phone,
          rating: favorite.rating ?? null,
          ratingCount: favorite.ratingCount ?? 0,
          openingHoursRaw: favorite.openingHoursRaw || null,
          openNow: null,
          images: [],
          distanceKm: distanceKm === null ? null : Math.round(distanceKm * 100) / 100,
          distance: null,
          favoriteId: favorite._id,
        };
      }),
    [favorites, location]
  );

  const categories = useMemo(() => {
    const counts = new Map();
    places.forEach((place) => counts.set(place.category, (counts.get(place.category) || 0) + 1));
    return [
      { key: "all", label: "All", count: places.length },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, label: categoryConfig(key).label, count })),
    ];
  }, [places]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return places.filter((place) => {
      if (category !== "all" && place.category !== category) return false;
      if (!needle) return true;
      return [place.name, place.address, place.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [places, term, category]);

  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container py-10 sm:py-14">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-50">
                  <Heart className="h-5 w-5 fill-danger-500 text-danger-500" aria-hidden="true" />
                </span>
                Saved places
              </h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                {favorites.length > 0
                  ? `${favorites.length} place${favorites.length === 1 ? "" : "s"} you have saved for later.`
                  : "Places you save show up here."}
              </p>
            </div>

            {!location ? (
              <Button variant="outline" size="sm" icon={MapPin} onClick={request} loading={isLocating}>
                Show distances
              </Button>
            ) : null}
          </header>

          {favorites.length > 0 ? (
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Search saved places"
                  aria-label="Search saved places"
                  className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-sm text-ink-soft placeholder:text-ink-faint focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
                />
              </div>

              <div className="lf-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                {categories.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCategory(item.key)}
                    aria-pressed={category === item.key}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      category === item.key
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-line bg-surface text-ink-muted hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                    <span className={category === item.key ? "text-white/70" : "text-ink-faint"}>
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            {!loaded ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (unused, index) => (
                  <BusinessCardSkeleton key={index} />
                ))}
              </div>
            ) : favorites.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No saved places yet"
                description="Tap the heart on any result to keep it here for later. Saved places sync to your account, so they are on every device you sign in to."
                action={<Button to="/explore">Explore nearby</Button>}
                className="rounded-card border border-dashed border-line bg-surface"
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="Nothing matches that"
                description="Try a different search term or category."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTerm("");
                      setCategory("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <RevealGroup stagger={0.05} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((place) => (
                  <RevealItem key={place.placeId}>
                    <BusinessCard
                      place={place}
                      layout="grid"
                      userLocation={location}
                      isFavorite
                      onToggleFavorite={() => removeFavorite(place.favoriteId)}
                    />
                  </RevealItem>
                ))}
              </RevealGroup>
            )}
          </div>
        </div>
      </PageTransition>
    </AppShell>
  );
}
