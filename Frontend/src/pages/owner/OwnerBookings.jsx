import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { CalendarCheck, CalendarX, Check, CheckCheck, X } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import PageTransition from "../../components/motion/PageTransition";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Skeleton from "../../components/common/Skeleton";
import { Textarea } from "../../components/common/Field";
import BookingCard from "../../components/booking/BookingCard";
import bookingApi from "../../services/bookingApi";
import ownerApi from "../../services/ownerApi";
import { formatDate } from "../../utils/format";

const SCOPES = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

/**
 * The owner's appointment book.
 *
 * Status changes go through the server's transition rules, so a
 * completed appointment cannot be dragged back to pending and a declined
 * one cannot be quietly revived. Declining asks for a reason, because
 * the customer is told what it says.
 */
export default function OwnerBookings() {
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(null);
  const [scope, setScope] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    ownerApi
      .overview()
      .then((data) => {
        setBusinesses(data.businesses);
        setBusinessId((current) => current || data.businesses[0]?._id || null);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError("");
    try {
      const data = await bookingApi.forBusiness(businessId, { scope });
      setBookings(data.bookings);
    } catch (requestError) {
      setError(requestError.message || "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [businessId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (booking, status, reason) => {
    setWorking(true);
    try {
      await bookingApi.setStatus(booking._id, status, reason);
      toast.success(
        status === "confirmed"
          ? "Booking confirmed - the customer has been notified"
          : status === "rejected"
            ? "Booking declined"
            : "Marked as complete"
      );
      setDeclining(null);
      setNote("");
      await load();
    } catch (actionError) {
      toast.error(actionError.message || "Could not update that booking");
    } finally {
      setWorking(false);
    }
  };

  // Grouped by local day so the list reads like a diary.
  const grouped = useMemo(() => {
    const groups = new Map();
    for (const booking of bookings) {
      const key = new Date(booking.startAt).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(booking);
    }
    return [...groups.entries()];
  }, [bookings]);

  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;

  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container max-w-3xl py-8 sm:py-10">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                  <CalendarCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
                </span>
                Appointments
              </h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                {pendingCount > 0
                  ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting for your reply.`
                  : "Accept, decline and close out your appointments."}
              </p>
            </div>

            {businesses.length > 1 ? (
              <select
                value={businessId || ""}
                onChange={(event) => setBusinessId(event.target.value)}
                aria-label="Choose a business"
                className="h-9 max-w-[12rem] rounded-lg border border-line bg-surface pl-2.5 pr-8 text-sm font-semibold text-ink-soft focus:border-brand-600 focus:outline-none"
              >
                {businesses.map((business) => (
                  <option key={business._id} value={business._id}>
                    {business.name}
                  </option>
                ))}
              </select>
            ) : null}
          </header>

          <div className="mt-6 flex rounded-xl border border-line bg-surface p-1">
            {SCOPES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setScope(item.key)}
                aria-pressed={scope === item.key}
                className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
                  scope === item.key ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-5">
            {loading ? (
              Array.from({ length: 3 }, (unused, index) => (
                <Skeleton key={index} className="h-40 w-full rounded-card" />
              ))
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : bookings.length === 0 ? (
              <EmptyState
                icon={CalendarX}
                title="No appointments here"
                description={
                  scope === "upcoming"
                    ? "Nothing booked yet. Make sure bookings are switched on and your services are published."
                    : "Nothing in this view."
                }
                action={
                  businessId ? (
                    <Button to={`/owner/businesses/${businessId}`} variant="outline">
                      Listing settings
                    </Button>
                  ) : null
                }
                className="rounded-card border border-dashed border-line bg-surface"
              />
            ) : (
              grouped.map(([day, items]) => (
                <section key={day}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">
                    {formatDate(items[0].startAt)}
                  </h2>
                  <div className="space-y-3">
                    {items.map((booking) => (
                      <BookingCard
                        key={booking._id}
                        booking={booking}
                        viewer="owner"
                        actions={
                          <>
                            {booking.status === "pending" ? (
                              <>
                                <Button
                                  variant="success"
                                  size="xs"
                                  icon={Check}
                                  loading={working}
                                  onClick={() => act(booking, "confirmed")}
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="dangerGhost"
                                  size="xs"
                                  icon={X}
                                  onClick={() => setDeclining(booking)}
                                >
                                  Decline
                                </Button>
                              </>
                            ) : null}

                            {booking.status === "confirmed" ? (
                              <>
                                {new Date(booking.startAt) <= new Date() ? (
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    icon={CheckCheck}
                                    loading={working}
                                    onClick={() => act(booking, "completed")}
                                  >
                                    Mark complete
                                  </Button>
                                ) : null}
                                <Button
                                  variant="dangerGhost"
                                  size="xs"
                                  icon={X}
                                  onClick={() => setDeclining(booking)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : null}
                          </>
                        }
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </PageTransition>

      <Modal
        open={Boolean(declining)}
        onClose={() => setDeclining(null)}
        title={declining?.status === "pending" ? "Decline this request?" : "Cancel this appointment?"}
        description="The customer is told, along with whatever reason you give."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclining(null)}>
              Back
            </Button>
            <Button
              variant="danger"
              loading={working}
              onClick={() => act(declining, declining.status === "pending" ? "rejected" : "cancelled", note.trim() || undefined)}
            >
              {declining?.status === "pending" ? "Decline" : "Cancel appointment"}
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          placeholder="e.g. Fully booked that afternoon - try 4pm instead?"
          hint="Shown to the customer. A short reason saves them a phone call."
          data-autofocus
        />
      </Modal>
    </AppShell>
  );
}
