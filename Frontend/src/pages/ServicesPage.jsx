import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Compass, List, MapIcon, MapPin, Navigation, SearchX, ShieldAlert } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import Pagination from "../components/common/Pagination";
import { BusinessCardSkeleton } from "../components/common/Skeleton";
import BusinessCard from "../components/business/BusinessCard";
import FilterBar from "../components/explore/FilterBar";
import MapPanel from "../components/explore/MapPanel";
import SearchField from "../components/explore/SearchField";
import Modal from "../components/common/Modal";
import ReviewsSection from "../components/reviews/ReviewsSection";
import placesApi from "../services/placesApi";
import useFavorites from "../hooks/useFavorites";
import useGeolocation from "../hooks/useGeolocation";
import useDebounce from "../hooks/useDebounce";
import { BUILT_IN_CATEGORY_FALLBACK } from "../config/categories";

const DEFAULT_FILTERS = {
  category: "all",
  radius: 3000,
  sort: "distance",
  openNow: false,
  minRating: 0,
  maxPrice: null,
  includeExternal: true,
  page: 1,
};

/**
 * Explore: the map-and-list discovery view.
 *
 * Map and list are two views of one array. Selecting a card flies the map
 * to that pin and opens its popup; clicking a pin scrolls the matching
 * card into view and highlights it. Selection is keyed by `placeId`, not
 * by name or array index, so two shops with the same name on the same
 * street stay distinct.
 *
 * Filters live in the URL, which makes any view shareable and makes the
 * browser's back button behave the way people expect.
 */
export default function ServicesPage({ selectedPosition, onLocationChange }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    category: searchParams.get("category") || searchParams.get("type") || DEFAULT_FILTERS.category,
    radius: Number(searchParams.get("radius")) || DEFAULT_FILTERS.radius,
    sort: searchParams.get("sort") || DEFAULT_FILTERS.sort,
    openNow: searchParams.get("openNow") === "1",
    minRating: Number(searchParams.get("minRating")) || 0,
    maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : null,
    page: Number(searchParams.get("page")) || 1,
  }));

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const debouncedQuery = useDebounce(query, 350);

  const [categories, setCategories] = useState(BUILT_IN_CATEGORY_FALLBACK);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1, radiusUsed: 3000, attribution: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [focusPosition, setFocusPosition] = useState(selectedPosition || null);
  const [mobileView, setMobileView] = useState("list");
  // One modal for the whole list rather than one per card.
  const [reviewTarget, setReviewTarget] = useState(null);
  // The point the search is anchored to - the user's location, or wherever
  // they last pressed "search this area".
  const [origin, setOrigin] = useState(null);

  const listRef = useRef(null);
  const cardRefs = useRef(new Map());
  const requestId = useRef(0);

  const { location, status: locationStatus, error: locationError, request, isLocating } = useGeolocation();
  const { favoriteByPlaceId, toggleFavorite } = useFavorites();

  /* ------------------------------------------------------------------ *
   * categories
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const controller = new AbortController();
    placesApi
      .categories({ signal: controller.signal })
      .then((data) => {
        if (data.categories?.length) setCategories(data.categories);
      })
      .catch(() => {
        // The built-in list is already rendered; a failure changes nothing.
      });
    return () => controller.abort();
  }, []);

  /* ------------------------------------------------------------------ *
   * location
   * ------------------------------------------------------------------ */
  useEffect(() => {
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask once on mount
  }, []);

  useEffect(() => {
    if (!location) return;
    setOrigin((current) => current || location);
    onLocationChange?.(location);
  }, [location, onLocationChange]);

  /* ------------------------------------------------------------------ *
   * search
   * ------------------------------------------------------------------ */
  const runSearch = useCallback(
    async (searchOrigin, activeFilters, term) => {
      if (!searchOrigin) return;
      const id = requestId.current + 1;
      requestId.current = id;

      setLoading(true);
      setError("");
      setNotice("");

      try {
        const data = await placesApi.nearby({
          lat: searchOrigin.lat,
          lng: searchOrigin.lng,
          category: activeFilters.category,
          radius: activeFilters.radius,
          q: term,
          openNow: activeFilters.openNow,
          minRating: activeFilters.minRating,
          maxPrice: activeFilters.maxPrice,
          sort: activeFilters.sort,
          page: activeFilters.page,
          limit: 20,
          includeExternal: activeFilters.includeExternal,
        });

        // Ignore a response that a newer request has already superseded.
        if (id !== requestId.current) return;

        setResults(data.results || []);
        setMeta({
          total: data.total || 0,
          pages: data.pages || 1,
          radiusUsed: data.radiusUsed || activeFilters.radius,
          attribution: data.attribution || null,
          registeredCount: data.registeredCount || 0,
          externalCount: data.externalCount || 0,
        });
        if (data.degraded) setNotice(data.message);
      } catch (requestError) {
        if (id !== requestId.current || requestError.name === "AbortError") return;
        setError(requestError.message || "Could not load results.");
        setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (origin) runSearch(origin, filters, debouncedQuery);
  }, [origin, filters, debouncedQuery, runSearch]);

  /* keep the URL in step with the current view */
  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.category !== "all") next.set("category", filters.category);
    if (debouncedQuery) next.set("q", debouncedQuery);
    if (filters.radius !== DEFAULT_FILTERS.radius) next.set("radius", String(filters.radius));
    if (filters.sort !== DEFAULT_FILTERS.sort) next.set("sort", filters.sort);
    if (filters.openNow) next.set("openNow", "1");
    if (filters.minRating) next.set("minRating", String(filters.minRating));
    if (filters.maxPrice) next.set("maxPrice", String(filters.maxPrice));
    if (filters.page > 1) next.set("page", String(filters.page));
    setSearchParams(next, { replace: true });
  }, [filters, debouncedQuery, setSearchParams]);

  /* the AI assistant can point the map at a result */
  useEffect(() => {
    if (selectedPosition) setFocusPosition(selectedPosition);
  }, [selectedPosition]);

  /* ------------------------------------------------------------------ *
   * selection, shared by map and list
   * ------------------------------------------------------------------ */
  const selectPlace = useCallback((place, { scroll = true } = {}) => {
    setSelectedId(place.placeId);
    setFocusPosition([place.lat, place.lng]);

    if (scroll) {
      const node = cardRefs.current.get(place.placeId);
      node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const selectFromMap = useCallback(
    (place) => {
      selectPlace(place);
      if (window.matchMedia("(max-width: 1023px)").matches) setMobileView("list");
    },
    [selectPlace]
  );

  const searchThisArea = useCallback((coords) => {
    setOrigin(coords);
    setFilters((current) => ({ ...current, page: 1 }));
  }, []);

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS, category: filters.category });
    setQuery("");
  };

  const findMe = async () => {
    const coords = await request();
    if (coords) {
      setOrigin(coords);
      setFocusPosition([coords.lat, coords.lng]);
    }
  };

  const hasOrigin = Boolean(origin);
  const showSkeletons = loading && results.length === 0;

  const radiusNotice = useMemo(() => {
    if (!meta.radiusUsed || meta.radiusUsed <= filters.radius) return null;
    return `Nothing within ${(filters.radius / 1000).toFixed(0)} km, so the search widened to ${(meta.radiusUsed / 1000).toFixed(0)} km.`;
  }, [meta.radiusUsed, filters.radius]);

  return (
    <AppShell fullHeight footer={false}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="border-b border-line bg-surface">
          <div className="lf-container flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <SearchField
                value={query}
                onChange={setQuery}
                onSubmit={() => setFilters((current) => ({ ...current, page: 1 }))}
                resultCount={meta.total}
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Navigation}
                onClick={findMe}
                loading={isLocating}
                className="whitespace-nowrap"
              >
                <span className="hidden sm:inline">My location</span>
                <span className="sm:hidden">Locate</span>
              </Button>

              {/* Map/list toggle, phones and tablets only */}
              <div className="flex rounded-lg border border-line bg-surface p-0.5 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  aria-pressed={mobileView === "list"}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    mobileView === "list" ? "bg-brand-600 text-white" : "text-ink-muted"
                  }`}
                >
                  <List className="h-3.5 w-3.5" aria-hidden="true" />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView("map")}
                  aria-pressed={mobileView === "map"}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    mobileView === "map" ? "bg-brand-600 text-white" : "text-ink-muted"
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Map
                </button>
              </div>
            </div>
          </div>
        </div>

        <FilterBar
          filters={filters}
          categories={categories}
          onChange={setFilters}
          onReset={resetFilters}
          resultCount={meta.total}
          loading={loading}
        />

        {/* Split view */}
        <div className="flex min-h-0 flex-1">
          {/* List */}
          <div
            ref={listRef}
            className={`lf-scroll min-h-0 w-full shrink-0 overflow-y-auto border-r border-line bg-canvas lg:block lg:w-[420px] xl:w-[460px] ${
              mobileView === "map" ? "hidden" : "block"
            }`}
          >
            <div className="space-y-3 p-4">
              {!hasOrigin && !isLocating ? (
                <EmptyState
                  icon={Compass}
                  title="Share your location to start exploring"
                  description="We use your coordinates to search around you. You can also drag the map and press “Search this area”."
                  action={
                    <Button icon={MapPin} onClick={findMe} loading={isLocating}>
                      Use my location
                    </Button>
                  }
                />
              ) : null}

              {locationStatus === "denied" && locationError && !hasOrigin ? (
                <ErrorState title="Location is blocked" message={locationError} onRetry={findMe} />
              ) : null}

              {notice ? (
                <div className="flex items-start gap-3 rounded-card border border-warning-100 bg-warning-50 p-3.5">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-warning-700">{notice}</p>
                </div>
              ) : null}

              {radiusNotice && !loading ? (
                <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
                  {radiusNotice}
                </p>
              ) : null}

              {error ? (
                <ErrorState message={error} onRetry={() => runSearch(origin, filters, debouncedQuery)} />
              ) : null}

              {showSkeletons
                ? Array.from({ length: 6 }, (unused, index) => <BusinessCardSkeleton key={index} />)
                : null}

              {!loading && hasOrigin && !error && results.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No matches in this area"
                  description="Try widening the radius, clearing a filter, or dragging the map somewhere else and searching again."
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : null}

              {results.map((place) => (
                <div
                  key={place.placeId}
                  ref={(node) => {
                    if (node) cardRefs.current.set(place.placeId, node);
                    else cardRefs.current.delete(place.placeId);
                  }}
                >
                  <BusinessCard
                    place={place}
                    selected={selectedId === place.placeId}
                    onSelect={selectPlace}
                    onOpenReviews={setReviewTarget}
                    userLocation={origin}
                    isFavorite={favoriteByPlaceId.has(place.placeId)}
                    onToggleFavorite={toggleFavorite}
                  />
                </div>
              ))}

              {meta.pages > 1 ? (
                <Pagination
                  page={filters.page}
                  pages={meta.pages}
                  onChange={(page) => {
                    setFilters((current) => ({ ...current, page }));
                    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="pt-2"
                />
              ) : null}

              {meta.attribution ? (
                <p className="pb-2 pt-1 text-center text-2xs text-ink-faint">
                  {meta.attribution}
                  {meta.registeredCount > 0
                    ? ` · ${meta.registeredCount} listed on LocalFinder`
                    : ""}
                </p>
              ) : null}
            </div>
          </div>

          {/* Map */}
          <div className={`min-h-0 flex-1 ${mobileView === "list" ? "hidden lg:block" : "block"}`}>
            <MapPanel
              places={results}
              userLocation={origin}
              focusPosition={focusPosition}
              selectedId={selectedId}
              onSelect={selectFromMap}
              radius={meta.radiusUsed || filters.radius}
              onSearchArea={searchThisArea}
            />
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget?.name}
        description="Reviews written by LocalFinder users"
        size="lg"
      >
        {reviewTarget ? (
          <ReviewsSection
            placeId={reviewTarget.placeId}
            placeName={reviewTarget.name}
            lat={reviewTarget.lat}
            lng={reviewTarget.lng}
            onSummaryChange={(summary) =>
              setResults((current) =>
                current.map((place) =>
                  place.placeId === reviewTarget.placeId
                    ? { ...place, rating: summary.rating, ratingCount: summary.count }
                    : place
                )
              )
            }
          />
        ) : null}
      </Modal>
    </AppShell>
  );
}
