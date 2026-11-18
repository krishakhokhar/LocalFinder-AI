import { memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarCheck,
  Clock,
  Heart,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Star,
} from "lucide-react";
import Badge from "../common/Badge";
import useMotionSafe from "../../hooks/useMotionSafe";
import { cardHover } from "../../utils/motion";
import { categoryConfig, displayType } from "../../utils/categories";
import { directionsUrl, formatCategory, formatDistance, formatPrice, formatRating } from "../../utils/format";

/**
 * The result card used everywhere a place is listed.
 *
 * Its central rule: show only what is actually known. A place with no
 * reviews says "No reviews yet" instead of a star score; a place with no
 * phone number in OpenStreetMap says "Phone not listed" as plain text
 * rather than offering a Call button that cannot work. Every visible
 * control here does something.
 */
function BusinessCard({
  place,
  isFavorite = false,
  onToggleFavorite,
  onSelect,
  onOpenReviews,
  selected = false,
  userLocation = null,
  layout = "list",
}) {
  const { interaction, reduce } = useMotionSafe();
  const config = categoryConfig(displayType(place));
  const Icon = config.icon;

  const rating = formatRating(place.rating);
  const distance = formatDistance(place);
  const priceFrom = formatPrice(place.priceFrom, place.currency);
  const detailsPath = place.businessId ? `/business/${place.businessId}` : null;

  // Three states, not two. OpenStreetMap records no opening hours for most
  // places, and showing nothing there reads as "we checked" - so unknown is
  // labelled as unknown rather than left blank or guessed at.
  const open =
    place.openNow === true
      ? { label: "Open now", tone: "success" }
      : place.openNow === false
        ? { label: "Closed", tone: "danger" }
        : { label: "Hours not listed", tone: "neutral" };

  const handleKeyDown = (event) => {
    if (!onSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(place);
    }
  };

  const heroImage = place.images?.[0] || place.logoUrl || null;

  return (
    <motion.article
      variants={interaction(cardHover)}
      initial="rest"
      whileHover={reduce ? undefined : "hover"}
      whileTap={onSelect && !reduce ? "tap" : undefined}
      onClick={onSelect ? () => onSelect(place) : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={onSelect ? 0 : undefined}
      role={onSelect ? "button" : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={onSelect ? `${place.name}, show on map` : undefined}
      className={`group relative flex overflow-hidden rounded-card border bg-surface transition-shadow duration-200 ${
        selected
          ? "border-brand-600 shadow-card ring-2 ring-brand-600/20"
          : "border-line shadow-soft hover:shadow-card"
      } ${onSelect ? "cursor-pointer" : ""} ${layout === "grid" ? "flex-col" : "flex-col"}`}
    >
      {/* Media: a real photo when the business provided one, otherwise a
          category tile. Never a stock image pretending to be this place. */}
      {layout === "grid" ? (
        <div className="relative h-36 w-full overflow-hidden bg-slate-100">
          {heroImage ? (
            <img
              src={heroImage}
              alt={`${place.name}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${config.tint}`}>
              <Icon className="h-9 w-9 opacity-70" aria-hidden="true" />
            </div>
          )}
          {place.verified ? (
            <span className="absolute left-3 top-3">
              <Badge tone="success" icon={BadgeCheck} size="xs">
                Verified
              </Badge>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          {layout === "list" ? (
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                heroImage ? "" : config.tint
              }`}
            >
              {heroImage ? (
                <img src={heroImage} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <Icon className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 font-display text-[0.95rem] font-bold leading-snug text-ink">
                {detailsPath ? (
                  <Link
                    to={detailsPath}
                    onClick={(event) => event.stopPropagation()}
                    className="hover:text-brand-700 hover:underline"
                  >
                    {place.name}
                  </Link>
                ) : (
                  place.name
                )}
              </h3>

              {onToggleFavorite ? (
                <motion.button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(place);
                  }}
                  whileTap={reduce ? undefined : { scale: 0.8 }}
                  animate={reduce ? undefined : isFavorite ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? `Remove ${place.name} from saved places` : `Save ${place.name}`}
                  className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-slate-100"
                >
                  <Heart
                    className={`h-[18px] w-[18px] transition-colors ${
                      isFavorite ? "fill-danger-500 text-danger-500" : ""
                    }`}
                    aria-hidden="true"
                  />
                </motion.button>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <span className="font-medium">{formatCategory(displayType(place))}</span>

              {rating ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-ink-soft">
                    <Star className="h-3 w-3 fill-warning-500 text-warning-500" aria-hidden="true" />
                    {rating}
                    <span className="font-normal text-ink-faint">({place.ratingCount})</span>
                  </span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-ink-faint">No reviews yet</span>
                </>
              )}

              {distance ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-brand-500" aria-hidden="true" />
                    {distance}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Status chips */}
        {open || priceFrom || place.acceptsBookings || (place.verified && layout === "list") ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {open ? (
              <Badge tone={open.tone} size="xs" icon={Clock}>
                {open.label}
              </Badge>
            ) : null}
            {place.verified && layout === "list" ? (
              <Badge tone="success" size="xs" icon={BadgeCheck}>
                Verified
              </Badge>
            ) : null}
            {place.acceptsBookings ? (
              <Badge tone="brand" size="xs" icon={CalendarCheck}>
                Bookable
              </Badge>
            ) : null}
            {priceFrom ? (
              <Badge tone="neutral" size="xs">
                From {priceFrom}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {place.address ? (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="lf-line-clamp-2">{place.address}</span>
          </p>
        ) : null}

        <div className="mt-3.5 flex items-center gap-2 pt-0.5">
          {place.phone ? (
            <a
              href={`tel:${place.phone}`}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-success-500 text-xs font-semibold text-white transition-colors hover:bg-success-600"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Call
            </a>
          ) : (
            // Not a button: there is nothing to click. Saying so plainly is
            // better than a control that does nothing.
            <span className="inline-flex h-9 flex-1 items-center justify-center rounded-xl border border-dashed border-line text-xs font-medium text-ink-faint">
              Phone not listed
            </span>
          )}

          <a
            href={directionsUrl({
              lat: place.lat,
              lng: place.lng,
              name: place.name,
              originLat: userLocation?.lat,
              originLng: userLocation?.lng,
            })}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
            Directions
          </a>

          {detailsPath ? (
            <Link
              to={detailsPath}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-line px-3 text-xs font-semibold text-ink-soft transition-colors hover:bg-slate-50"
            >
              Details
            </Link>
          ) : onOpenReviews ? (
            // OpenStreetMap places have no profile page of their own, so
            // reviews are reachable directly from the card. The first real
            // rating a map place gets comes from here.
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenReviews(place);
              }}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold text-ink-soft transition-colors hover:bg-slate-50"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {place.ratingCount > 0 ? place.ratingCount : "Review"}
            </button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

export default memo(BusinessCard);
