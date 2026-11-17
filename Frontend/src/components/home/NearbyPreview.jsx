import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Compass, MapPin, RefreshCw, ShieldAlert } from "lucide-react";
import Button from "../common/Button";
import EmptyState from "../common/EmptyState";
import ErrorState from "../common/ErrorState";
import SectionHeading from "../common/SectionHeading";
import { RevealGroup, RevealItem } from "../common/Reveal";
import { BusinessCardSkeleton } from "../common/Skeleton";
import BusinessCard from "../business/BusinessCard";
import placesApi from "../../services/placesApi";
import useGeolocation from "../../hooks/useGeolocation";
import useFavorites from "../../hooks/useFavorites";

/**
 * Real nearby results on the home page.
 *
 * Nothing here is seeded, cached from a fixture or hard-coded: before the
 * user shares their location there is simply nothing to show, and the
 * section says so and offers the one action that changes that.
 */
export default function NearbyPreview() {
  const { location, status, error: locationError, request, isLocating } = useGeolocation();
  const { favoriteByPlaceId, toggleFavorite } = useFavorites();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (coords) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await placesApi.nearby({
        lat: coords.lat,
        lng: coords.lng,
        category: "all",
        radius: 3000,
        sort: "relevance",
        limit: 6,
      });
      setPlaces(data.results || []);
      if (data.degraded) setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message || "Could not load nearby places.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location) load(location);
  }, [location, load]);

  const findNearMe = async () => {
    const coords = await request();
    if (coords) load(coords);
  };

  return (
    <section className="border-y border-line bg-surface py-16 sm:py-20">
      <div className="lf-container">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <SectionHeading
            align="left"
            eyebrow="Near you"
            title="Real places, right around you"
            subtitle="Live results from OpenStreetMap and businesses registered on LocalFinder. Ratings come from our own reviewers — never generated."
            className="max-w-2xl"
          />
          {places.length > 0 ? (
            <Button to="/explore" variant="outline" size="sm" iconRight={ArrowRight} className="shrink-0">
              Explore all
            </Button>
          ) : null}
        </div>

        <div className="mt-9">
          {!location && !isLocating ? (
            <EmptyState
              icon={Compass}
              title="Share your location to see what's nearby"
              description="We use your coordinates only to search for places around you. Nothing is stored on our servers."
              action={
                <Button icon={MapPin} onClick={findNearMe} loading={isLocating}>
                  Find places near me
                </Button>
              }
              secondaryAction={
                <Button to="/explore" variant="outline">
                  Browse the map instead
                </Button>
              }
            />
          ) : null}

          {status === "denied" && locationError ? (
            <ErrorState
              title="Location is blocked"
              message={locationError}
              onRetry={findNearMe}
              className="mx-auto max-w-xl"
            />
          ) : null}

          {(isLocating || loading) && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (unused, index) => (
                <BusinessCardSkeleton key={index} />
              ))}
            </div>
          )}

          {!loading && error ? <ErrorState message={error} onRetry={() => location && load(location)} /> : null}

          {!loading && notice ? (
            <div className="mb-5 flex items-start gap-3 rounded-card border border-warning-100 bg-warning-50 p-4">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
              <p className="text-sm text-warning-700">{notice}</p>
            </div>
          ) : null}

          {!loading && !error && location && places.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="Nothing mapped around you yet"
              description="We widened the search and still found no listed businesses nearby. Try the full explore view, where you can change the radius and category."
              action={
                <Button to="/explore" iconRight={ArrowRight}>
                  Open Explore
                </Button>
              }
              secondaryAction={
                <Button variant="outline" icon={RefreshCw} onClick={() => load(location)}>
                  Retry
                </Button>
              }
            />
          ) : null}

          {!loading && places.length > 0 ? (
            <RevealGroup stagger={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((place) => (
                <RevealItem key={place.placeId}>
                  <BusinessCard
                    place={place}
                    layout="grid"
                    userLocation={location}
                    isFavorite={favoriteByPlaceId.has(place.placeId)}
                    onToggleFavorite={toggleFavorite}
                  />
                </RevealItem>
              ))}
            </RevealGroup>
          ) : null}
        </div>
      </div>
    </section>
  );
}
