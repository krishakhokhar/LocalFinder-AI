import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Clock, Info } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";
import { Textarea } from "../common/Field";
import useMotionSafe from "../../hooks/useMotionSafe";
import bookingApi from "../../services/bookingApi";
import { useAuth } from "../../context/AuthContext";
import { formatDateTime, formatPrice, toDateInputValue } from "../../utils/format";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayLabel(dateString, today) {
  if (dateString === today) return "Today";
  const tomorrow = toDateInputValue(new Date(new Date(`${today}T00:00:00`).getTime() + DAY_MS));
  if (dateString === tomorrow) return "Tomorrow";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Book an appointment: pick a service, a day, then a real slot.
 *
 * Availability is fetched per day from the server and re-checked when
 * the booking is submitted, so a slot that filled while this was open
 * fails with a clear message rather than quietly double-booking. Nothing
 * in this component invents availability - a day with no free slots says
 * so, and says why (closed, fully booked, or too late to book today).
 */
export default function BookingModal({ open, onClose, business, onBooked }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { reduce } = useMotionSafe();

  const services = useMemo(
    () => (business?.services || []).filter((service) => service.active !== false),
    [business]
  );

  const [serviceId, setServiceId] = useState(null);
  // Captured once so render stays pure - see the day strip below.
  const [today] = useState(() => toDateInputValue(new Date()));
  const [date, setDate] = useState(today);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    if (open && services.length > 0) setServiceId((current) => current || services[0]._id);
  }, [open, services]);

  useEffect(() => {
    if (!open) {
      setConfirmed(null);
      setSelectedSlot(null);
      setNote("");
    }
  }, [open]);

  // Pulled out so the dependency is the id itself rather than the whole
  // business object - otherwise the callback is rebuilt on every render
  // that touches any field of it.
  const businessId = business?._id;

  const loadAvailability = useCallback(async () => {
    if (!open || !businessId || !serviceId) return;
    setLoading(true);
    try {
      const data = await bookingApi.availability({ businessId, serviceId, date });
      setAvailability(data);
    } catch (error) {
      setAvailability({ slots: [], closed: true, reason: error.message });
    } finally {
      setLoading(false);
    }
  }, [open, businessId, serviceId, date]);

  useEffect(() => {
    setSelectedSlot(null);
    loadAvailability();
  }, [loadAvailability]);

  const maxAdvanceDays = availability?.settings?.maxAdvanceDays || 30;
  const days = useMemo(() => {
    // `today` is captured once in state rather than read from the clock
    // here: reading Date.now() during render makes the render impure, so
    // two renders a millisecond apart could disagree about which day is
    // first in the strip.
    const start = new Date(`${today}T00:00:00`).getTime();
    const list = [];
    for (let offset = 0; offset < Math.min(14, maxAdvanceDays); offset += 1) {
      list.push(toDateInputValue(new Date(start + offset * DAY_MS)));
    }
    return list;
  }, [maxAdvanceDays, today]);

  const service = services.find((item) => item._id === serviceId);
  const openSlots = (availability?.slots || []).filter((slot) => slot.available);

  const submit = async () => {
    if (!isAuthenticated) {
      onClose();
      navigate("/auth", { state: { from: `/business/${business._id}` } });
      return;
    }
    if (!selectedSlot) return;

    setSubmitting(true);
    try {
      const data = await bookingApi.create({
        businessId: business._id,
        serviceId,
        startAt: selectedSlot.startAt,
        note: note.trim() || undefined,
      });
      setConfirmed(data.booking);
      onBooked?.(data.booking);
    } catch (error) {
      toast.error(error.message || "Could not complete that booking");
      // The slot list is stale if the failure was a race - reload it.
      if (error.code === "SLOT_TAKEN" || error.code === "SLOT_UNAVAILABLE") {
        await loadAvailability();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Booking sent"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button to="/bookings" onClick={onClose}>
              View my bookings
            </Button>
          </>
        }
      >
        <div className="py-2 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
            <CheckCircle2 className="h-6 w-6 text-success-600" aria-hidden="true" />
          </span>
          <p className="mt-3 font-display text-base font-bold text-ink">
            {confirmed.status === "confirmed" ? "Confirmed" : "Request sent"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {confirmed.service.name} at {business.name}
            <br />
            <span className="font-semibold text-ink-soft">{formatDateTime(confirmed.startAt)}</span>
          </p>
          <p className="mt-3 text-xs text-ink-faint">
            {confirmed.status === "confirmed"
              ? "The business has confirmed this appointment."
              : "The business still needs to confirm. You will get a notification either way."}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Book at ${business?.name || ""}`}
      description={isAuthenticated ? undefined : "You will be asked to sign in before confirming."}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting} disabled={!selectedSlot}>
            {isAuthenticated ? "Confirm booking" : "Sign in to book"}
          </Button>
        </>
      }
    >
      {services.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          This business has not published any bookable services yet.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Service */}
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Service</p>
            <div className="space-y-2">
              {services.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setServiceId(item._id)}
                  aria-pressed={serviceId === item._id}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                    serviceId === item._id
                      ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/15"
                      : "border-line hover:border-line-strong"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {item.durationMinutes} min
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-ink">
                    {item.price !== null && item.price !== undefined ? (
                      formatPrice(item.price, item.currency)
                    ) : (
                      <span className="text-xs font-medium text-ink-faint">On request</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Day */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
              <CalendarDays className="h-4 w-4 text-ink-faint" aria-hidden="true" />
              Date
            </p>
            <div className="lf-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDate(day)}
                  aria-pressed={date === day}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    date === day
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-line bg-surface text-ink-muted hover:bg-slate-50"
                  }`}
                >
                  {dayLabel(day, today)}
                </button>
              ))}
            </div>
          </div>

          {/* Slots */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-soft">Time</p>
              {openSlots.length > 0 ? (
                <span className="text-xs text-ink-faint">
                  {openSlots.length} slot{openSlots.length === 1 ? "" : "s"} free
                </span>
              ) : null}
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner label="Checking availability" />
              </div>
            ) : availability?.closed ? (
              <p className="flex items-start gap-2 rounded-card border border-line bg-slate-50 p-3.5 text-sm text-ink-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                {availability.reason || "Closed on this day."}
              </p>
            ) : openSlots.length === 0 ? (
              <p className="flex items-start gap-2 rounded-card border border-line bg-slate-50 p-3.5 text-sm text-ink-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                Every slot on this day is taken or has passed. Try another date.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <AnimatePresence initial={false}>
                  {availability.slots.map((slot) => (
                    <motion.button
                      key={slot.startAt}
                      type="button"
                      layout={!reduce}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot)}
                      aria-pressed={selectedSlot?.startAt === slot.startAt}
                      title={
                        slot.available
                          ? `${slot.seatsLeft} place${slot.seatsLeft === 1 ? "" : "s"} left`
                          : slot.reason === "full"
                            ? "Fully booked"
                            : slot.reason === "too-soon"
                              ? "Too soon to book"
                              : "This time has passed"
                      }
                      className={`rounded-lg border py-2 text-xs font-semibold tabular-nums transition-colors ${
                        selectedSlot?.startAt === slot.startAt
                          ? "border-brand-600 bg-brand-600 text-white"
                          : slot.available
                            ? "border-line bg-surface text-ink-soft hover:border-brand-300 hover:bg-brand-50"
                            : "cursor-not-allowed border-line bg-slate-50 text-ink-faint line-through"
                      }`}
                    >
                      {slot.label}
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {selectedSlot ? (
            <Textarea
              label="Anything the business should know?"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              placeholder="Optional"
            />
          ) : null}

          {selectedSlot ? (
            <div className="rounded-card border border-brand-200 bg-brand-50/60 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">You are booking</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {service?.name} · {formatDateTime(selectedSlot.startAt)}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {service?.durationMinutes} minutes
                {service?.price !== null && service?.price !== undefined
                  ? ` · ${formatPrice(service.price, service.currency)} payable at the business`
                  : " · price confirmed by the business"}
              </p>
              {!availability?.settings?.autoConfirm ? (
                <p className="mt-1.5 text-xs text-ink-faint">
                  This is a request. The business confirms it before it is final.
                </p>
              ) : null}
            </div>
          ) : null}

          {user && !user.phone ? (
            <p className="text-xs text-ink-faint">
              Tip: add a phone number in your account so the business can reach you about this
              appointment.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
