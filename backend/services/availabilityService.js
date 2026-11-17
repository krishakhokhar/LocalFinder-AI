import Booking, { ACTIVE_BOOKING_STATUSES } from "../models/Booking.js";

/**
 * Slot generation.
 *
 * Availability is derived, never stored. A stored calendar of free slots
 * has to be kept in step with opening hours, service durations, capacity
 * and every booking and cancellation - and the moment it drifts, the app
 * is offering appointments that do not exist. Computing it from the
 * business's own hours plus the bookings that actually exist means it
 * cannot drift, by construction.
 *
 * All arithmetic is done in the business's local time, expressed as an
 * offset from UTC. The server runs in UTC and the customer may be in a
 * different timezone again; the only clock that matters for "are you
 * open at 3pm" is the one on the shop wall.
 */

const MINUTE = 60 * 1000;
const DAY_MINUTES = 24 * 60;

/** Start of a local calendar day, as a real UTC instant. */
export function localDayStartUtc(dateString, tzOffsetMinutes) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - tzOffsetMinutes * MINUTE);
}

/** Weekday (0 = Sunday) of a local calendar date. */
export function localWeekday(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function minutesFromHHMM(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * @param {object} params
 * @param {object} params.business        a Business document
 * @param {object} params.service         the chosen embedded service
 * @param {string} params.date            "YYYY-MM-DD" in the business's local time
 * @param {number} params.tzOffsetMinutes offset of the business's local time from UTC
 * @param {Array}  params.bookings        active bookings overlapping that day
 * @param {Date}   [params.now]
 *
 * @returns {{slots: Array<{startAt:string, endAt:string, label:string, available:boolean, seatsLeft:number, reason:string|null}>, closed:boolean}}
 */
export function buildSlots({ business, service, date, tzOffsetMinutes, bookings = [], now = new Date() }) {
  const settings = business.bookingSettings || {};
  const slotMinutes = settings.slotMinutes || 30;
  const capacity = settings.capacityPerSlot || 1;
  const leadMinutes = settings.leadTimeMinutes ?? 60;
  const duration = service.durationMinutes || slotMinutes;

  const weekday = localWeekday(date);
  const hours = (business.openingHours || []).find((row) => row.day === weekday);

  if (!hours || hours.closed) {
    return { slots: [], closed: true, reason: "The business is closed on this day." };
  }

  const dayStart = localDayStartUtc(date, tzOffsetMinutes);
  const openMinutes = minutesFromHHMM(hours.open);
  let closeMinutes = minutesFromHHMM(hours.close);
  // A shop open 18:00-02:00 closes the following morning.
  if (closeMinutes <= openMinutes) closeMinutes += DAY_MINUTES;

  // The earliest appointment a customer may book, given the lead time.
  const earliest = new Date(now.getTime() + leadMinutes * MINUTE);

  /** Active bookings that overlap a candidate window. */
  const seatsTaken = (startAt, endAt) => {
    const taken = new Set();
    let overlapping = 0;
    for (const booking of bookings) {
      const bookingStart = new Date(booking.startAt).getTime();
      const bookingEnd = new Date(booking.endAt).getTime();
      if (bookingStart < endAt.getTime() && bookingEnd > startAt.getTime()) {
        overlapping += 1;
        taken.add(booking.seat ?? 0);
      }
    }
    return { overlapping, taken };
  };

  const slots = [];
  for (let offset = openMinutes; offset + duration <= closeMinutes; offset += slotMinutes) {
    const startAt = new Date(dayStart.getTime() + offset * MINUTE);
    const endAt = new Date(startAt.getTime() + duration * MINUTE);

    const { overlapping, taken } = seatsTaken(startAt, endAt);
    const seatsLeft = Math.max(0, capacity - overlapping);

    // The first seat number nobody is occupying, so concurrent bookings
    // at the same time land on different seats and the unique index can
    // tell them apart.
    let seat = 0;
    while (taken.has(seat) && seat < capacity) seat += 1;

    let available = true;
    let reason = null;

    if (startAt <= now) {
      available = false;
      reason = "past";
    } else if (startAt < earliest) {
      available = false;
      reason = "too-soon";
    } else if (seatsLeft <= 0) {
      available = false;
      reason = "full";
    }

    slots.push({
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      // Rendered in the business's local time, which is what the slot means.
      label: new Date(startAt.getTime() + tzOffsetMinutes * MINUTE)
        .toISOString()
        .slice(11, 16),
      available,
      seatsLeft,
      seat: available ? seat : null,
      reason,
    });
  }

  return { slots, closed: false, reason: null };
}

/** Active bookings that touch a local day, for slot generation. */
export async function activeBookingsForDay({ businessId, date, tzOffsetMinutes }) {
  const dayStart = localDayStartUtc(date, tzOffsetMinutes);
  const dayEnd = new Date(dayStart.getTime() + 36 * 60 * MINUTE); // generous, covers past-midnight closes

  return Booking.find({
    business: businessId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    startAt: { $gte: new Date(dayStart.getTime() - 12 * 60 * MINUTE), $lt: dayEnd },
  })
    .select("startAt endAt seat status")
    .lean();
}

/**
 * Re-validates a slot at the moment of booking.
 *
 * The slot list the customer saw may be seconds or minutes old. This
 * recomputes availability from scratch and refuses anything that is no
 * longer offerable, so a stale page cannot book a slot that has since
 * closed. The unique index is the final backstop for the race that
 * remains between this check and the insert.
 */
export async function validateSlot({ business, service, startAt, tzOffsetMinutes, now = new Date() }) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, message: "That is not a valid appointment time." };
  }

  const settings = business.bookingSettings || {};
  const maxAdvanceMs = (settings.maxAdvanceDays || 30) * 24 * 60 * MINUTE;
  if (start.getTime() - now.getTime() > maxAdvanceMs) {
    return {
      ok: false,
      message: `This business takes bookings up to ${settings.maxAdvanceDays || 30} days ahead.`,
    };
  }

  // The local calendar date the requested instant falls on.
  const localDate = new Date(start.getTime() + tzOffsetMinutes * MINUTE).toISOString().slice(0, 10);

  const bookings = await activeBookingsForDay({
    businessId: business._id,
    date: localDate,
    tzOffsetMinutes,
  });

  const { slots, closed, reason } = buildSlots({
    business,
    service,
    date: localDate,
    tzOffsetMinutes,
    bookings,
    now,
  });

  if (closed) return { ok: false, message: reason };

  const slot = slots.find((candidate) => candidate.startAt === start.toISOString());
  if (!slot) {
    return { ok: false, message: "That time is not one of this business's appointment slots." };
  }
  if (!slot.available) {
    const messages = {
      past: "That time has already passed.",
      "too-soon": "That slot is too soon - this business needs more notice.",
      full: "That slot was just taken. Please choose another.",
    };
    return { ok: false, message: messages[slot.reason] || "That slot is not available." };
  }

  return { ok: true, slot };
}
