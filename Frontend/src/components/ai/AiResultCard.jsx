import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, MapPin, Navigation, Phone, Star } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { categoryConfig, displayType } from "../../utils/categories";
import { directionsUrl, formatCategory, formatRating } from "../../utils/format";

/**
 * A compact result inside the chat.
 *
 * Shows the same honest fields as the main card: a rating only when
 * reviews exist, and "no reviews yet" otherwise. Selecting it both
 * focuses the map behind the assistant and marks it for comparison.
 */
export default function AiResultCard({ place, index, onFocus, selected = false, onToggleCompare, userLocation }) {
  const { reduce } = useMotionSafe();
  const config = categoryConfig(displayType(place));
  const Icon = config.icon;
  const rating = formatRating(place.rating);

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : index * 0.05, duration: 0.25 }}
      className={`rounded-xl border bg-surface p-2.5 transition-colors ${
        selected ? "border-ai-400 bg-ai-50/40" : "border-line hover:border-line-strong"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {onToggleCompare ? (
          <button
            type="button"
            onClick={() => onToggleCompare(place)}
            aria-pressed={selected}
            aria-label={selected ? `Remove ${place.name} from comparison` : `Add ${place.name} to comparison`}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
              selected ? "border-ai-500 bg-ai-500 text-white" : "border-line-strong bg-surface hover:border-ai-400"
            }`}
          >
            {selected ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
          </button>
        ) : (
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${config.tint}`}>
            <Icon className="h-3 w-3" aria-hidden="true" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onFocus?.(place)}
            className="block w-full truncate text-left text-xs font-bold text-ink hover:text-brand-700"
          >
            {place.name}
          </button>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-ink-muted">
            <span>{formatCategory(displayType(place))}</span>
            {place.distance ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
                  {place.distance}
                </span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            {rating ? (
              <span className="inline-flex items-center gap-0.5 font-semibold text-ink-soft">
                <Star className="h-2.5 w-2.5 fill-warning-500 text-warning-500" aria-hidden="true" />
                {rating} ({place.ratingCount})
              </span>
            ) : (
              <span className="text-ink-faint">No reviews yet</span>
            )}
            {place.openNow === true ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-success-600">Open</span>
              </>
            ) : place.openNow === false ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-danger-600">Closed</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {place.phone ? (
            <a
              href={`tel:${place.phone}`}
              aria-label={`Call ${place.name}`}
              className="rounded-lg p-1.5 text-success-600 transition-colors hover:bg-success-50"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}

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
            aria-label={`Directions to ${place.name}`}
            className="rounded-lg p-1.5 text-brand-600 transition-colors hover:bg-brand-50"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          {place.businessId ? (
            <Link
              to={`/business/${place.businessId}`}
              aria-label={`View ${place.name} details`}
              className="rounded-lg px-1.5 py-1 text-2xs font-semibold text-ink-muted transition-colors hover:bg-slate-100"
            >
              Details
            </Link>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
