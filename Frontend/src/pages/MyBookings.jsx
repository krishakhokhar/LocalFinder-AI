import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { CalendarClock, CalendarX, Star, XCircle } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import PageTransition from "../components/motion/PageTransition";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import Skeleton from "../components/common/Skeleton";
import { Textarea } from "../components/common/Field";
import BookingCard from "../components/booking/BookingCard";
import ReviewsSection from "../components/reviews/ReviewsSection";
import bookingApi from "../services/bookingApi";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

/**
 * The customer's appointments.
 *
 * A completed booking offers a review link, because that is the moment
 * someone actually has something to say - and a review written off the
 * back of a completed booking carries the verified badge.
 */
export default function MyBookings() {
  const [scope, setScope] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await bookingApi.mine(scope);
      setBookings(data.bookings);
    } catch (requestError) {
      setError(requestError.message || "Could not load your bookings.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async () => {
    setWorking(true);
    try {
      await bookingApi.cancel(cancelling._id, reason.trim() || undefined);
      toast.success("Booking cancelled");
      setCancelling(null);
      setReason("");
      await load();
    } catch (cancelError) {
      toast.error(cancelError.message || "Could not cancel that booking");
    } finally {
      setWorking(false);
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container max-w-3xl py-8 sm:py-10">
          <header>
            <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                <CalendarClock className="h-5 w-5 text-brand-600" aria-hidden="true" />
              </span>
              My bookings
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Appointments you have requested or confirmed with local businesses.
            </p>
          </header>

          <div className="mt-6 flex rounded-xl border border-line bg-surface p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setScope(tab.key)}
                aria-pressed={scope === tab.key}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  scope === tab.key ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              Array.from({ length: 3 }, (unused, index) => (
                <Skeleton key={index} className="h-40 w-full rounded-card" />
              ))
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : bookings.length === 0 ? (
              <EmptyState
                icon={CalendarX}
                title={scope === "upcoming" ? "No upcoming appointments" : "Nothing here yet"}
                description={
                  scope === "upcoming"
                    ? "When you book with a business that takes appointments, it shows up here."
                    : "Past and cancelled appointments will appear here."
                }
                action={<Button to="/explore">Find a business</Button>}
                className="rounded-card border border-dashed border-line bg-surface"
              />
            ) : (
              bookings.map((booking) => (
                <BookingCard
                  key={booking._id}
                  booking={booking}
                  viewer="customer"
                  actions={
                    <>
                      {["pending", "confirmed"].includes(booking.status) &&
                      new Date(booking.startAt) > new Date() ? (
                        <Button
                          variant="dangerGhost"
                          size="xs"
                          icon={XCircle}
                          onClick={() => setCancelling(booking)}
                        >
                          Cancel
                        </Button>
                      ) : null}

                      {booking.status === "completed" ? (
                        <Button
                          variant="outline"
                          size="xs"
                          icon={Star}
                          onClick={() => setReviewing(booking)}
                        >
                          Write a review
                        </Button>
                      ) : null}

                      {booking.business?._id ? (
                        <Button to={`/business/${booking.business._id}`} variant="ghost" size="xs">
                          View business
                        </Button>
                      ) : null}
                    </>
                  }
                />
              ))
            )}
          </div>
        </div>
      </PageTransition>

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this appointment?"
        description="The business will be notified and the slot goes back on sale."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={cancel} loading={working}>
              Cancel booking
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (optional)"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          placeholder="Helps the business plan around it"
          data-autofocus
        />
      </Modal>

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title={reviewing?.business?.name}
        description="Your review is marked as a verified booking."
        size="lg"
      >
        {reviewing?.business?._id ? (
          <ReviewsSection
            placeId={`lf:${reviewing.business._id}`}
            placeName={reviewing.business.name}
            lat={reviewing.business.lat}
            lng={reviewing.business.lng}
          />
        ) : null}
      </Modal>
    </AppShell>
  );
}
