import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Compass, List, MapIcon, MapPin, Navigation, SearchX, ShieldAlert } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import Pagination from "../components/common/Pagination";
import { BusinessCardSkeleton } from "../components/common/Skeleton";
import Spinner from "../components/common/Spinner";
import BusinessCard from "../components/business/BusinessCard";
import FilterBar, {
  RADIUS_OPTIONS,
  SORT_OPTIONS,
  RATING_OPTIONS,
  SOURCE_OPTIONS,
} from "../components/explore/FilterBar";
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
  source: "all",
  page: 1,
};

const VALID_RADII = RADIUS_OPTIONS.map((option) => option.value);
const VALID_SORTS = SORT_OPTIONS.map((option) => option.value);
const VALID_RATINGS = RATING_OPTIONS.map((option) => option.value);
const VALID_SOURCES = SOURCE_OPTIONS.map((option) => option.value);

/**
 * Filters read back out of the URL.
 *
 * Every value is checked against the options the UI actually offers. A URL
 * is user-editable input: `?radius=99999` or `?sort=drop%20table` must fall
 * back to the default rather than being passed to the API or, worse, put
 * the filter bar into a state none of its buttons can represent.
 */
function readFilters(searchParams) {
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  const number = (raw) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const maxPriceRaw = number(searchParams.get("maxPrice"));

  return {
    ...DEFAULT_FILTERS,
    category: searchParams.get("category") || searchParams.get("type") || DEFAULT_FILTERS.category,
    radius: pick(number(searchParams.get("radius")), VALID_RADII, DEFAULT_FILTERS.radius),
    sort: pick(searchParams.get("sort"), VALID_SORTS, DEFAULT_FILTERS.sort),
    // Accept both `1` and `true`, since shared links use either.
    openNow: ["1", "true"].includes(searchParams.get("openNow")),
    minRating: pick(number(searchParams.get("minRating")), VALID_RATINGS, 0),
    // A negative or non-numeric budget is not a budget.
    maxPrice: maxPriceRaw !== null && maxPriceRaw > 0 ? maxPriceRaw : null,
    source: pick(searchParams.get("source"), VALID_SOURCES, DEFAULT_FILTERS.source),
    page: Math.max(1, Math.min(100, number(searchParams.get("page")) || 1)),
  };
}

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

  const [filters, setFilters] = useState(() => readFilters(searchParams));

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
  const abortRef = useRef(null);
  const lastWrittenUrl = useRef(null);

  // Don't leave a request running after the page is gone.
  useEffect(() => () => abortRef.current?.abort(), []);

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
    if (import.meta.env.DEV) {
      console.debug("[explore] using detected location as search origin", {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy ?? null,
      });
    }
    // The map follows `origin` (see MapPanel's FollowLocation), so setting
    // it here is what moves the view onto the real position.
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

      // Actually cancel the previous request rather than just ignoring its
      // reply: a superseded search was still occupying a connection and
      // still costing the upstream provider a query.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

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
          source: activeFilters.source,
        }, { signal: controller.signal });

        // Ignore a response that a newer request has already superseded.
        if (id !== requestId.current) return;

        const places = data.results || [];

        if (import.meta.env.DEV) {
          console.debug("[explore] nearby", {
            sent: { ...searchOrigin, category: activeFilters.category, radius: activeFilters.radius, openNow: activeFilters.openNow, q: term },
            got: {
              total: data.total,
              returned: places.length,
              provider: data.provider,
              radiusUsed: data.radiusUsed,
              registeredCount: data.registeredCount,
              externalCount: data.externalCount,
              degraded: data.degraded,
              timedOut: data.timedOut,
            },
          });
        }

        setResults(places);
        setMeta({
          total: data.total || 0,
          pages: data.pages || 1,
          radiusUsed: data.radiusUsed || activeFilters.radius,
          attribution: data.attribution || null,
          registeredCount: data.registeredCount || 0,
          externalCount: data.externalCount || 0,
          suggestedRadius: data.suggestedRadius || null,
          hiddenByOpenNow: data.hiddenByOpenNow || 0,
          hiddenByRating: data.hiddenByRating || 0,
          hiddenByPrice: data.hiddenByPrice || 0,
          unknownHoursCount: data.unknownHoursCount || 0,
          ratedCount: data.ratedCount || 0,
          pricedCount: data.pricedCount || 0,
        });

        // A search that failed or was cut short did not finish looking, so
        // it must never be presented as "there is nothing here". With no
        // results at all it is an error with a retry; with partial results
        // it is a warning above the list.
        const incomplete = Boolean(data.degraded || data.timedOut);
        if (incomplete && places.length === 0) {
          setError(
            data.message ||
              "We couldn't reach live map data just now, so this search is incomplete. Please try again."
          );
        } else if (incomplete) {
          setNotice(data.message || "Some map data was unavailable, so results may be incomplete.");
        }
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
    // Was never written, so the source filter silently reset on reload.
    if (filters.source !== DEFAULT_FILTERS.source) next.set("source", filters.source);
    if (filters.page > 1) next.set("page", String(filters.page));

    // Only touch history when something actually changed - this effect also
    // runs on the render caused by its own update.
    if (next.toString() === searchParams.toString()) return;

    // Remember what we wrote, so the reader below can tell our own push
    // apart from a genuine Back/Forward navigation.
    lastWrittenUrl.current = next.toString();

    // A real history entry, not a replacement: `replace: true` meant Back
    // left the page entirely instead of undoing the last filter change.
    setSearchParams(next);
  }, [filters, debouncedQuery, searchParams, setSearchParams]);

  /**
   * Back/forward: adopt whatever the restored URL says.
   *
   * Skipped for URLs this page just wrote. Without that guard, typing a
   * search term fights itself: the URL carries the *debounced* term, so
   * adopting it would overwrite the newer characters still in the box.
   */
  useEffect(() => {
    if (searchParams.toString() === lastWrittenUrl.current) return;

    const fromUrl = readFilters(searchParams);
    setFilters((current) => {
      const same = Object.keys(fromUrl).every((key) => current[key] === fromUrl[key]);
      return same ? current : fromUrl;
    });
    const urlQuery = searchParams.get("q") || "";
    setQuery((current) => (current === urlQuery ? current : urlQuery));
  }, [searchParams]);

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

  /**
   * Clears every filter including the category and the search term.
   * `origin` is deliberately untouched: the user's location is not a
   * filter, and making them re-share it to clear a price cap would be
   * a bad trade.
   */
  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setQuery("");
  };

  /**
   * "My location" must genuinely re-measure. `maximumAge: 0` forbids the
   * browser from handing back a cached fix, which is what makes this a
   * refresh rather than a repeat of whatever was already on screen.
   */
  const findMe = async () => {
    const coords = await request({ maximumAge: 0 });
    if (coords) {
      setOrigin(coords);
      setFocusPosition([coords.lat, coords.lng]);
      // A new origin means the previous page of results no longer applies.
      setFilters((current) => ({ ...current, page: 1 }));
    }
  };

  const hasOrigin = Boolean(origin);
  const showSkeletons = loading && results.length === 0;

  /**
   * What the result set actually represents. The radius is stated outright
   * because results are never silently taken from a wider area, and the
   * Open Now caveat is stated because OpenStreetMap simply has no hours for
   * most places - calling those "closed" would hide almost everything.
   */
  /**
   * Why the list is empty, named precisely.
   *
   * "No matches" is the one thing an empty result never explains. The
   * backend reports how many candidates each filter removed, so the most
   * destructive filter can be named - which matters most for rating and
   * price, where nothing in the dataset carries the data the filter needs
   * and the filter therefore looks broken rather than strict.
   */
  const emptyReason = useMemo(() => {
    const km = (filters.radius / 1000).toFixed(0);
    if (meta.hiddenByRating > 0) {
      return {
        title: `No places rated ${filters.minRating.toFixed(1)}+ here`,
        description:
          `${meta.hiddenByRating} nearby ${meta.hiddenByRating === 1 ? "place was" : "places were"} hidden because ` +
          "they have no LocalFinder reviews yet. Ratings come only from reviews written here, so unreviewed " +
          "places cannot meet a minimum rating.",
      };
    }
    if (meta.hiddenByPrice > 0) {
      return {
        title: `No places priced up to ₹${filters.maxPrice}`,
        description:
          `${meta.hiddenByPrice} nearby ${meta.hiddenByPrice === 1 ? "place was" : "places were"} hidden because ` +
          "they publish no prices. Pricing comes from registered businesses; map data carries none, so those " +
          "places are not claimed to be within budget.",
      };
    }
    if (meta.hiddenByOpenNow > 0) {
      return {
        title: "Nothing open right now",
        description: `${meta.hiddenByOpenNow} nearby ${meta.hiddenByOpenNow === 1 ? "place is" : "places are"} closed at the moment. Places with no published hours are still shown.`,
      };
    }
    if (filters.source === "registered") {
      return {
        title: "No registered businesses here yet",
        description:
          "Only businesses listed directly with LocalFinder are being shown. Switch to “All” to include places from OpenStreetMap.",
      };
    }
    return {
      title: `Nothing within ${km} km`,
      description:
        "OpenStreetMap has no places of this kind mapped in this area. Try a wider radius or a different category.",
    };
  }, [meta.hiddenByRating, meta.hiddenByPrice, meta.hiddenByOpenNow, filters.minRating, filters.maxPrice, filters.radius, filters.source]);

  const radiusNotice = useMemo(() => {
    if (results.length === 0) return null;
    const parts = [`${meta.total} within ${((meta.radiusUsed || filters.radius) / 1000).toFixed(0)} km`];
    if (filters.openNow && meta.unknownHoursCount > 0) {
      parts.push(`${meta.unknownHoursCount} with hours not listed`);
    }
    if (meta.hiddenByOpenNow > 0) {
      parts.push(`${meta.hiddenByOpenNow} hidden as closed`);
    }
    return parts.join(" · ");
  }, [meta.total, meta.radiusUsed, meta.unknownHoursCount, meta.hiddenByOpenNow, filters.radius, filters.openNow, results.length]);

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
          {/* List: 35% to the map's 65%, with a min and max so cards stay
              readable on a laptop and the panel does not sprawl on an
              ultrawide. Below lg the two views swap via the toggle. */}
          <div
            ref={listRef}
            className={`lf-scroll min-h-0 w-full shrink-0 overflow-y-auto border-r border-line bg-canvas lg:block lg:w-[35%] lg:min-w-[380px] lg:max-w-[560px] ${
              mobileView === "map" ? "hidden" : "block"
            }`}
          >
            <div className="space-y-3 p-4">
              {/* Detecting: say so explicitly rather than leaving a blank
                  panel, and never imply a location we do not have yet. */}
              {isLocating && !hasOrigin ? (
                <div className="flex items-start gap-3 rounded-card border border-line bg-surface p-4">
                  <Spinner size="sm" label="Detecting your location" className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-ink">Detecting your location…</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      Allow location access when your browser asks. This can take a few seconds for a
                      high-accuracy fix.
                    </p>
                  </div>
                </div>
              ) : null}

              {!hasOrigin && !isLocating && locationStatus !== "denied" && locationStatus !== "unavailable" ? (
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

              {/* Denied / unavailable: offer both ways forward - retry the
                  browser prompt, or pick an area manually on the map. */}
              {(locationStatus === "denied" || locationStatus === "unavailable") && locationError && !hasOrigin ? (
                <ErrorState
                  title={locationStatus === "denied" ? "Location is blocked" : "Couldn't detect your location"}
                  message={`${locationError} Your results will stay empty until a location is set.`}
                  onRetry={findMe}
                />
              ) : null}

              {/* The actual measured coordinates, so it is always visible
                  which point the results are anchored to. */}
              {hasOrigin ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="truncate text-2xs text-ink-faint">
                    <span className="font-semibold text-ink-muted">
                      {location && origin.lat === location.lat && origin.lng === location.lng
                        ? "Your location"
                        : "Searching around"}
                    </span>{" "}
                    {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
                    {location?.accuracy && origin.lat === location.lat
                      ? ` · ±${Math.round(location.accuracy)} m`
                      : ""}
                  </p>
                  <button
                    type="button"
                    onClick={findMe}
                    className="shrink-0 text-2xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Refresh
                  </button>
                </div>
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
                <ErrorState
                  title="Couldn't complete the search"
                  message={error}
                  onRetry={() => runSearch(origin, filters, debouncedQuery)}
                />
              ) : null}

              {showSkeletons
                ? Array.from({ length: 6 }, (unused, index) => <BusinessCardSkeleton key={index} />)
                : null}

              {!loading && hasOrigin && !error && results.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title={emptyReason.title}
                  description={emptyReason.description}
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {/* Each offer undoes exactly the filter that emptied
                          the list, so the fix is one click and no filter
                          changes without the user asking. */}
                      {meta.hiddenByRating > 0 ? (
                        <Button
                          onClick={() => setFilters((current) => ({ ...current, minRating: 0, page: 1 }))}
                        >
                          Remove the rating filter
                        </Button>
                      ) : null}
                      {meta.hiddenByPrice > 0 ? (
                        <Button
                          onClick={() => setFilters((current) => ({ ...current, maxPrice: null, page: 1 }))}
                        >
                          Remove the price filter
                        </Button>
                      ) : null}
                      {meta.hiddenByOpenNow > 0 ? (
                        <Button
                          variant="outline"
                          onClick={() => setFilters((current) => ({ ...current, openNow: false, page: 1 }))}
                        >
                          Turn off “Open now”
                        </Button>
                      ) : null}
                      {filters.source !== "all" ? (
                        <Button
                          variant="outline"
                          onClick={() => setFilters((current) => ({ ...current, source: "all", page: 1 }))}
                        >
                          Search all sources
                        </Button>
                      ) : null}
                      {meta.suggestedRadius ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setFilters((current) => ({ ...current, radius: meta.suggestedRadius, page: 1 }))
                          }
                        >
                          Search {(meta.suggestedRadius / 1000).toFixed(0)} km instead
                        </Button>
                      ) : null}
                      <Button variant="outline" onClick={resetFilters}>
                        Clear all filters
                      </Button>
                    </div>
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
              locating={isLocating}
              locationBlocked={locationStatus === "denied" || locationStatus === "unavailable"}
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
