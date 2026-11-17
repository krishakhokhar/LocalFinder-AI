import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Globe,
  Heart,
  Mail,
  MapPin,
  Navigation,
  Phone,
  CalendarCheck,
  Star,
  Store,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import PageTransition from "../components/motion/PageTransition";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import Skeleton from "../components/common/Skeleton";
import Reveal from "../components/common/Reveal";
import BusinessGallery from "../components/business/BusinessGallery";
import HoursTable from "../components/business/HoursTable";
import MapPanel from "../components/explore/MapPanel";
import ReviewsSection from "../components/reviews/ReviewsSection";
import BookingModal from "../components/booking/BookingModal";
import businessApi from "../services/businessApi";
import useFavorites from "../hooks/useFavorites";
import useGeolocation from "../hooks/useGeolocation";
import { categoryConfig } from "../utils/categories";
import { directionsUrl, formatCategory, formatPrice, formatRating } from "../utils/format";
import { haversineKm } from "../utils/distance";

function DetailsSkeleton() {
  return (
    <div className="lf-container space-y-6 py-8">
      <Skeleton className="h-52 w-full rounded-card sm:h-64" />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    </div>
  );
}

/**
 * Full profile for a business registered on LocalFinder.
 *
 * Every section is conditional on real data existing. A business with no
 * description, no services and no hours renders a short, honest page that
 * says what is missing - rather than a long page padded with placeholders.
 */
export default function BusinessDetails() {
  const { id } = useParams();
  const { location } = useGeolocation({ auto: true });
  const { favoriteByPlaceId, toggleFavorite } = useFavorites();

  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await businessApi.get(id);
      setBusiness(data.business);
    } catch (requestError) {
      setError(
        requestError.status === 404
          ? "This listing does not exist, or it is not published yet."
          : requestError.message || "Could not load this listing."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AppShell>
        <DetailsSkeleton />
      </AppShell>
    );
  }

  if (error || !business) {
    return (
      <AppShell>
        <div className="lf-container py-10">
          <EmptyState
            icon={Store}
            title="Listing unavailable"
            description={error}
            action={<Button to="/explore">Explore other places</Button>}
            className="min-h-[50vh]"
          />
        </div>
      </AppShell>
    );
  }

  const config = categoryConfig(business.category);
  const Icon = config.icon;
  const rating = formatRating(business.rating);
  const isFavorite = favoriteByPlaceId.has(business.placeId);
  const distanceKm = location ? haversineKm(location.lat, location.lng, business.lat, business.lng) : null;

  const recordAnd = (type) => () => {
    businessApi.recordInteraction(business._id, type).catch(() => {
      // Analytics only - never block the thing the user actually wanted.
    });
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container py-6 sm:py-8">
          <Link
            to="/explore"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to explore
          </Link>

          <Reveal>
            <BusinessGallery images={business.gallery} name={business.name} category={business.category} />
          </Reveal>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            {/* Main column */}
            <div>
              <Reveal>
                <div className="flex items-start gap-4">
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl2 ${
                      business.logoUrl ? "border border-line" : config.tint
                    }`}
                  >
                    {business.logoUrl ? (
                      <img
                        src={business.logoUrl}
                        alt={`${business.name} logo`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                        {business.name}
                      </h1>
                      {business.verified ? (
                        <Badge tone="success" icon={BadgeCheck}>
                          Verified
                        </Badge>
                      ) : null}
                      {business.status && business.status !== "approved" ? (
                        <Badge tone="warning">Preview · {business.status}</Badge>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-muted">
                      <span className="font-medium">{formatCategory(business.category)}</span>

                      {rating ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-ink-soft">
                          <Star className="h-3.5 w-3.5 fill-warning-500 text-warning-500" aria-hidden="true" />
                          {rating}
                          <span className="font-normal text-ink-faint">
                            ({business.ratingCount} {business.ratingCount === 1 ? "review" : "reviews"})
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-faint">No reviews yet</span>
                      )}

                      {distanceKm !== null ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
                          {distanceKm < 1
                            ? `${Math.round(distanceKm * 1000)} m away`
                            : `${distanceKm.toFixed(1)} km away`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Actions */}
              <Reveal delay={0.05} className="mt-5 flex flex-wrap gap-2">
                {business.acceptsBookings ? (
                  <Button icon={CalendarCheck} onClick={() => setBookingOpen(true)}>
                    Book appointment
                  </Button>
                ) : null}

                {business.phone ? (
                  <Button href={`tel:${business.phone}`} variant="success" icon={Phone} onClick={recordAnd("call")}>
                    Call
                  </Button>
                ) : null}

                <Button
                  href={directionsUrl({
                    lat: business.lat,
                    lng: business.lng,
                    name: business.name,
                    originLat: location?.lat,
                    originLng: location?.lng,
                  })}
                  target="_blank"
                  rel="noreferrer noopener"
                  variant="outline"
                  icon={Navigation}
                  onClick={recordAnd("directions")}
                >
                  Directions
                </Button>

                <Button
                  variant={isFavorite ? "secondary" : "outline"}
                  icon={Heart}
                  onClick={() =>
                    toggleFavorite({
                      placeId: business.placeId,
                      name: business.name,
                      category: business.category,
                      lat: business.lat,
                      lng: business.lng,
                      address: business.addressLine,
                      phone: business.phone,
                    })
                  }
                >
                  {isFavorite ? "Saved" : "Save"}
                </Button>
              </Reveal>

              {/* About */}
              {business.description ? (
                <Reveal delay={0.08} className="mt-7">
                  <h2 className="font-display text-base font-bold text-ink">About</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                    {business.description}
                  </p>
                </Reveal>
              ) : null}

              {/* Services */}
              <Reveal delay={0.1} className="mt-7">
                <h2 className="font-display text-base font-bold text-ink">Services</h2>
                {business.services.length === 0 ? (
                  <p className="mt-2 rounded-card border border-dashed border-line bg-surface p-4 text-sm text-ink-muted">
                    This business has not published a service list yet.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                    {business.services.map((service) => (
                      <li key={service._id} className="flex items-start justify-between gap-4 p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{service.name}</p>
                          {service.description ? (
                            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                              {service.description}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-ink-faint">
                            About {service.durationMinutes} minutes
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {service.price !== null ? (
                            <p className="font-display text-sm font-bold text-ink">
                              {formatPrice(service.price, service.currency)}
                            </p>
                          ) : (
                            <p className="text-xs font-medium text-ink-faint">Price on request</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Reveal>

              {/* Amenities */}
              {business.amenities?.length > 0 ? (
                <Reveal delay={0.12} className="mt-7">
                  <h2 className="font-display text-base font-bold text-ink">Good to know</h2>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {business.amenities.map((amenity) => (
                      <Badge key={amenity} tone="outline">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </Reveal>
              ) : null}

              <ReviewsSection
                placeId={business.placeId}
                placeName={business.name}
                lat={business.lat}
                lng={business.lng}
                onSummaryChange={(summary) =>
                  setBusiness((current) =>
                    current ? { ...current, rating: summary.rating, ratingCount: summary.count } : current
                  )
                }
              />
            </div>

            {/* Sidebar */}
            <aside className="space-y-4">
              <Reveal delay={0.05}>
                <div className="overflow-hidden rounded-card border border-line">
                  <div className="h-56">
                    <MapPanel
                      places={[
                        {
                          placeId: business.placeId,
                          name: business.name,
                          category: business.category,
                          osmType: null,
                          lat: business.lat,
                          lng: business.lng,
                          rating: business.rating,
                          ratingCount: business.ratingCount,
                          source: "localfinder",
                          businessId: business._id,
                          address: business.addressLine,
                          openNow: null,
                        },
                      ]}
                      userLocation={location}
                      focusPosition={[business.lat, business.lng]}
                      selectedId={null}
                      showRadius={false}
                      onSearchArea={null}
                    />
                  </div>

                  <div className="space-y-2.5 bg-surface p-4">
                    {business.addressLine ? (
                      <p className="flex items-start gap-2 text-sm text-ink-soft">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <span>
                          {business.addressLine}
                          {business.address?.pincode ? ` - ${business.address.pincode}` : ""}
                        </span>
                      </p>
                    ) : null}

                    {business.phone ? (
                      <p className="flex items-center gap-2 text-sm text-ink-soft">
                        <Phone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <a href={`tel:${business.phone}`} className="hover:underline">
                          {business.phone}
                        </a>
                      </p>
                    ) : null}

                    {business.email ? (
                      <p className="flex items-center gap-2 text-sm text-ink-soft">
                        <Mail className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <a href={`mailto:${business.email}`} className="truncate hover:underline">
                          {business.email}
                        </a>
                      </p>
                    ) : null}

                    {business.website ? (
                      <p className="flex items-center gap-2 text-sm text-ink-soft">
                        <Globe className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <a
                          href={business.website}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="truncate hover:underline"
                        >
                          {business.website.replace(/^https?:\/\//, "")}
                        </a>
                      </p>
                    ) : null}

                    {!business.phone && !business.email && !business.website ? (
                      <p className="text-sm text-ink-faint">No contact details published.</p>
                    ) : null}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <HoursTable hours={business.openingHours} />
              </Reveal>
            </aside>
          </div>
        </div>
      </PageTransition>

      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        business={business}
      />
    </AppShell>
  );
}
