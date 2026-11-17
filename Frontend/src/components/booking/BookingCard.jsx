import { Link } from "react-router-dom";
import {
  CalendarClock,
  Clock,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Store,
  User as UserIcon,
} from "lucide-react";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { directionsUrl, formatDateTime, formatPrice, formatRelative } from "../../utils/format";

export const STATUS_META = {
  pending: { tone: "warning", label: "Awaiting confirmation" },
  confirmed: { tone: "success", label: "Confirmed" },
  completed: { tone: "brand", label: "Completed" },
  rejected: { tone: "danger", label: "Declined" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

/**
 * One appointment, from either side.
 *
 * `viewer` switches whose details are shown and which actions appear: a
 * customer sees the business and can cancel or reschedule; an owner sees
 * the customer's contact details and can accept, decline or complete.
 */
export default function BookingCard({ booking, viewer = "customer", actions = null }) {
  const status = STATUS_META[booking.status] || STATUS_META.pending;
  const isUpcoming = new Date(booking.startAt) > new Date();
  const other = viewer === "owner" ? booking.customer : booking.business;

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-brand-600">
            {viewer === "customer" && booking.business?.logoUrl ? (
              <img src={booking.business.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : viewer === "owner" ? (
              <UserIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Store className="h-4 w-4" aria-hidden="true" />
            )}
          </span>

          <div className="min-w-0">
            <h3 className="truncate font-display text-sm font-bold text-ink">{booking.service?.name}</h3>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {viewer === "owner" ? (
                other?.name
              ) : booking.business?._id ? (
                <Link to={`/business/${booking.business._id}`} className="hover:underline">
                  {other?.name}
                </Link>
              ) : (
                other?.name
              )}
            </p>
          </div>
        </div>

        <Badge tone={status.tone} size="xs">
          {status.label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <CalendarClock className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          {formatDateTime(booking.startAt)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {booking.service?.durationMinutes} min
        </span>
        {booking.service?.price !== null && booking.service?.price !== undefined ? (
          <span className="font-semibold text-ink">
            {formatPrice(booking.service.price, booking.service.currency)}
          </span>
        ) : (
          <span className="text-ink-faint">Price on request</span>
        )}
        {isUpcoming ? (
          <span className="text-ink-faint">{formatRelative(booking.startAt)}</span>
        ) : null}
      </div>

      {booking.customerNote ? (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-muted">
          <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {booking.customerNote}
        </p>
      ) : null}

      {booking.cancellationReason ? (
        <p className="mt-2.5 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {booking.cancelledBy === "owner" ? "The business said: " : "Reason: "}
          {booking.cancellationReason}
        </p>
      ) : null}

      {/* Contact row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {viewer === "owner" && other?.phone ? (
          <Button href={`tel:${other.phone}`} variant="outline" size="xs" icon={Phone}>
            {other.phone}
          </Button>
        ) : null}

        {viewer === "customer" && booking.business?.phone ? (
          <Button href={`tel:${booking.business.phone}`} variant="outline" size="xs" icon={Phone}>
            Call
          </Button>
        ) : null}

        {viewer === "customer" && booking.business?.lat ? (
          <Button
            href={directionsUrl({
              lat: booking.business.lat,
              lng: booking.business.lng,
              name: booking.business.name,
            })}
            target="_blank"
            rel="noreferrer noopener"
            variant="outline"
            size="xs"
            icon={Navigation}
          >
            Directions
          </Button>
        ) : null}

        {viewer === "customer" && booking.business?.address ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">{booking.business.address}</span>
          </span>
        ) : null}
      </div>

      {actions ? <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{actions}</div> : null}
    </article>
  );
}
