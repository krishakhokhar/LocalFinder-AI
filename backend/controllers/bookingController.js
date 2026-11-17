import Booking, { buildSlotKey } from "../models/Booking.js";
import Business from "../models/Business.js";
import { ApiError, created, ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { activeBookingsForDay, buildSlots, validateSlot } from "../services/availabilityService.js";
import { notify } from "../services/notificationService.js";
import { recordEvent } from "../services/analyticsService.js";
import { formatDateTime } from "../utils/datetime.js";

function toPublicBooking(booking, { viewer = "customer" } = {}) {
  const business = booking.business && typeof booking.business === "object" ? booking.business : null;
  const customer = booking.customer && typeof booking.customer === "object" ? booking.customer : null;

  const base = {
    _id: booking._id,
    status: booking.status,
    startAt: booking.startAt,
    endAt: booking.endAt,
    tzOffsetMinutes: booking.tzOffsetMinutes,
    service: booking.service,
    customerNote: booking.customerNote || null,
    ownerNote: booking.ownerNote || null,
    cancelledBy: booking.cancelledBy || null,
    cancellationReason: booking.cancellationReason || null,
    createdAt: booking.createdAt,
    business: business
      ? {
          _id: business._id,
          name: business.name,
          phone: business.phone || null,
          logoUrl: business.logoUrl || null,
          address:
            [business.address?.line1, business.address?.area, business.address?.city]
              .filter(Boolean)
              .join(", ") || null,
          lat: business.location?.coordinates?.[1] ?? null,
          lng: business.location?.coordinates?.[0] ?? null,
        }
      : booking.business,
  };

  if (viewer === "owner") {
    return {
      ...base,
      customer: {
        _id: customer?._id,
        name: customer?.name || booking.contact?.name || "Customer",
        // The owner needs to be able to reach the person who booked.
        phone: customer?.phone || booking.contact?.phone || null,
        email: customer?.email || booking.contact?.email || null,
      },
    };
  }

  return base;
}

/* ========================================================================= *
 * Availability
 * ========================================================================= */

/**
 * GET /api/bookings/availability
 *
 * Slots are computed on demand from the business's hours and its real
 * bookings. Nothing about availability is stored, so there is no cached
 * calendar that can drift out of step and offer a slot that is gone.
 */
export const getAvailability = asyncHandler(async (req, res) => {
  const { businessId, serviceId, date, tz } = req.validatedQuery;

  const business = await Business.findById(businessId);
  if (!business || business.status !== "approved") {
    throw ApiError.notFound("That business is not taking bookings");
  }
  if (!business.acceptsBookings) {
    throw ApiError.badRequest("This business does not take online appointments");
  }

  const service = business.services.id(serviceId);
  if (!service || !service.active) {
    throw ApiError.notFound("That service is not available");
  }

  const tzOffsetMinutes = tz ?? 0;
  const bookings = await activeBookingsForDay({ businessId: business._id, date, tzOffsetMinutes });
  const { slots, closed, reason } = buildSlots({
    business,
    service,
    date,
    tzOffsetMinutes,
    bookings,
  });

  return ok(res, {
    date,
    closed,
    reason: reason || null,
    slots,
    service: {
      _id: service._id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      price: typeof service.price === "number" ? service.price : null,
      currency: service.currency || "INR",
    },
    settings: {
      maxAdvanceDays: business.bookingSettings?.maxAdvanceDays || 30,
      leadTimeMinutes: business.bookingSettings?.leadTimeMinutes ?? 60,
      autoConfirm: Boolean(business.bookingSettings?.autoConfirm),
    },
  });
});

/* ========================================================================= *
 * Customer
 * ========================================================================= */

/**
 * POST /api/bookings
 *
 * Double booking is prevented in two layers, and the second one is the
 * one that actually holds:
 *
 *  1. The slot is re-validated against live data, so a stale page cannot
 *     book something that has since filled.
 *  2. `slotKey` carries a unique index. Two requests that pass step 1 at
 *     the same instant will both try to insert the same key and exactly
 *     one will succeed; the loser gets a duplicate-key error, which is
 *     translated into "that slot was just taken".
 *
 * Without the index, step 1 alone is a check-then-act race that fails
 * precisely when the system is busiest.
 */
export const createBooking = asyncHandler(async (req, res) => {
  const { businessId, serviceId, startAt, note, contact, tz } = req.body;

  const business = await Business.findById(businessId);
  if (!business || business.status !== "approved" || !business.acceptsBookings) {
    throw ApiError.notFound("That business is not taking bookings");
  }

  const service = business.services.id(serviceId);
  if (!service || !service.active) {
    throw ApiError.notFound("That service is not available");
  }
  if (String(business.owner) === String(req.user._id)) {
    throw ApiError.badRequest("You cannot book an appointment with your own business");
  }

  const tzOffsetMinutes = tz ?? 0;
  const check = await validateSlot({ business, service, startAt, tzOffsetMinutes });
  if (!check.ok) {
    throw ApiError.conflict(check.message, { code: "SLOT_UNAVAILABLE" });
  }

  // One active booking per customer per slot, so a double-tap on the
  // confirm button cannot produce two appointments.
  const duplicate = await Booking.findOne({
    business: business._id,
    customer: req.user._id,
    startAt: new Date(check.slot.startAt),
    status: { $in: ["pending", "confirmed"] },
  }).lean();
  if (duplicate) {
    throw ApiError.conflict("You already have a booking at that time with this business");
  }

  const autoConfirm = Boolean(business.bookingSettings?.autoConfirm);

  let booking;
  try {
    booking = await Booking.create({
      business: business._id,
      customer: req.user._id,
      service: {
        serviceId: service._id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        price: typeof service.price === "number" ? service.price : null,
        currency: service.currency || "INR",
      },
      startAt: new Date(check.slot.startAt),
      endAt: new Date(check.slot.endAt),
      tzOffsetMinutes,
      seat: check.slot.seat,
      slotKey: buildSlotKey(business._id, check.slot.startAt, check.slot.seat),
      status: autoConfirm ? "confirmed" : "pending",
      confirmedAt: autoConfirm ? new Date() : undefined,
      contact: {
        name: contact?.name || req.user.name,
        phone: contact?.phone || req.user.phone,
        email: contact?.email || req.user.email,
      },
      customerNote: note,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict("That slot was just taken. Please pick another time.", {
        code: "SLOT_TAKEN",
      });
    }
    throw error;
  }

  const when = formatDateTime(booking.startAt, tzOffsetMinutes);

  await Promise.all([
    notify.create(business.owner, {
      type: "booking_created",
      title: autoConfirm ? "New confirmed booking" : "New booking request",
      body: `${req.user.name} booked ${service.name} for ${when}.`,
      link: "/owner/bookings",
      data: { bookingId: String(booking._id), businessId: String(business._id) },
    }),
    notify.create(req.user._id, {
      type: autoConfirm ? "booking_confirmed" : "booking_created",
      title: autoConfirm ? "Booking confirmed" : "Booking requested",
      body: autoConfirm
        ? `${business.name} confirmed your ${service.name} on ${when}.`
        : `${business.name} has your request for ${service.name} on ${when}. You will hear back shortly.`,
      link: "/bookings",
      data: { bookingId: String(booking._id) },
    }),
  ]);

  recordEvent({ type: "booking_created", business: business._id, user: req.user._id });

  await booking.populate("business", "name phone logoUrl address location");

  return created(res, {
    message: autoConfirm
      ? "Booked. You will find it under My bookings."
      : "Request sent. The business will confirm shortly.",
    booking: toPublicBooking(booking),
  });
});

/** GET /api/bookings/mine */
export const myBookings = asyncHandler(async (req, res) => {
  const { scope } = req.validatedQuery;
  const now = new Date();

  const filter = { customer: req.user._id };
  if (scope === "upcoming") {
    filter.status = { $in: ["pending", "confirmed"] };
    filter.startAt = { $gte: now };
  } else if (scope === "past") {
    filter.$or = [{ startAt: { $lt: now } }, { status: { $in: ["completed", "cancelled", "rejected"] } }];
  }

  const bookings = await Booking.find(filter)
    .sort(scope === "upcoming" ? { startAt: 1 } : { startAt: -1 })
    .limit(100)
    .populate("business", "name phone logoUrl address location")
    .lean();

  return ok(res, { bookings: bookings.map((booking) => toPublicBooking(booking)) });
});

/**
 * POST /api/bookings/:id/cancel
 *
 * Cancelling clears `slotKey`, which is what actually frees the slot:
 * the unique index ignores documents without the field, so the time
 * becomes bookable again the moment this runs.
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.validatedParams.id).populate("business", "name owner");
  if (!booking) throw ApiError.notFound("Booking not found");

  const isCustomer = String(booking.customer) === String(req.user._id);
  const isOwner = booking.business && String(booking.business.owner) === String(req.user._id);
  if (!isCustomer && !isOwner && req.user.role !== "admin") {
    throw ApiError.forbidden("You cannot cancel this booking");
  }

  if (["cancelled", "rejected", "completed"].includes(booking.status)) {
    throw ApiError.badRequest(`This booking is already ${booking.status}`);
  }

  booking.status = "cancelled";
  booking.cancelledBy = isCustomer ? "customer" : isOwner ? "owner" : "admin";
  booking.cancelledAt = new Date();
  booking.cancellationReason = req.body.reason;
  booking.slotKey = undefined;
  await booking.save();

  const when = formatDateTime(booking.startAt, booking.tzOffsetMinutes);
  const recipient = isCustomer ? booking.business?.owner : booking.customer;

  await notify.create(recipient, {
    type: "booking_cancelled",
    title: "Booking cancelled",
    body: `The ${booking.service.name} appointment on ${when} was cancelled${
      req.body.reason ? `: ${req.body.reason}` : "."
    }`,
    link: isCustomer ? "/owner/bookings" : "/bookings",
    data: { bookingId: String(booking._id) },
  });

  return ok(res, { message: "Booking cancelled", booking: toPublicBooking(booking) });
});

/**
 * POST /api/bookings/:id/reschedule
 *
 * Implemented as "validate the new slot, then move" rather than
 * cancel-and-rebook, so the customer never loses their place if the new
 * time turns out to be unavailable.
 */
export const rescheduleBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.validatedParams.id);
  if (!booking) throw ApiError.notFound("Booking not found");
  if (String(booking.customer) !== String(req.user._id)) {
    throw ApiError.forbidden("You can only reschedule your own bookings");
  }
  if (!["pending", "confirmed"].includes(booking.status)) {
    throw ApiError.badRequest(`A ${booking.status} booking cannot be rescheduled`);
  }

  const business = await Business.findById(booking.business);
  if (!business || !business.acceptsBookings) {
    throw ApiError.badRequest("This business is no longer taking bookings");
  }

  const service =
    business.services.id(booking.service.serviceId) || {
      _id: booking.service.serviceId,
      name: booking.service.name,
      durationMinutes: booking.service.durationMinutes,
    };

  const tzOffsetMinutes = req.body.tz ?? booking.tzOffsetMinutes ?? 0;
  const check = await validateSlot({ business, service, startAt: req.body.startAt, tzOffsetMinutes });
  if (!check.ok) throw ApiError.conflict(check.message, { code: "SLOT_UNAVAILABLE" });

  const previous = formatDateTime(booking.startAt, booking.tzOffsetMinutes);

  booking.startAt = new Date(check.slot.startAt);
  booking.endAt = new Date(check.slot.endAt);
  booking.seat = check.slot.seat;
  booking.tzOffsetMinutes = tzOffsetMinutes;
  booking.slotKey = buildSlotKey(business._id, check.slot.startAt, check.slot.seat);
  // Moving an appointment needs the owner's agreement again.
  booking.status = "pending";
  booking.confirmedAt = undefined;
  booking.reminderSentAt = null;

  try {
    await booking.save();
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict("That slot was just taken. Please pick another time.", { code: "SLOT_TAKEN" });
    }
    throw error;
  }

  await notify.create(business.owner, {
    type: "booking_created",
    title: "Booking rescheduled",
    body: `${req.user.name} moved their ${booking.service.name} from ${previous} to ${formatDateTime(
      booking.startAt,
      tzOffsetMinutes
    )}.`,
    link: "/owner/bookings",
    data: { bookingId: String(booking._id) },
  });

  return ok(res, { message: "Booking moved. The business will confirm the new time.", booking: toPublicBooking(booking) });
});

/* ========================================================================= *
 * Owner
 * ========================================================================= */

/** GET /api/bookings/business/:id */
export const businessBookings = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.validatedParams.id).select("owner name").lean();
  if (!business) throw ApiError.notFound("Business not found");
  if (String(business.owner) !== String(req.user._id) && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only view bookings for your own business");
  }

  const { scope, status } = req.validatedQuery;
  const now = new Date();

  const filter = { business: business._id };
  if (status) filter.status = status;
  if (scope === "upcoming") {
    filter.startAt = { $gte: now };
    if (!status) filter.status = { $in: ["pending", "confirmed"] };
  } else if (scope === "today") {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    filter.startAt = { $gte: dayStart, $lt: dayEnd };
  } else if (scope === "past") {
    filter.startAt = { $lt: now };
  }

  const bookings = await Booking.find(filter)
    .sort(scope === "past" ? { startAt: -1 } : { startAt: 1 })
    .limit(200)
    .populate("customer", "name phone email")
    .populate("business", "name phone logoUrl address location")
    .lean();

  return ok(res, { bookings: bookings.map((booking) => toPublicBooking(booking, { viewer: "owner" })) });
});

/**
 * PATCH /api/bookings/:id/status
 *
 * The owner's accept / decline / complete action. Transitions are
 * explicit rather than "set any status": allowing an arbitrary jump
 * would let a completed booking be dragged back to pending, and a
 * rejected one quietly revived.
 */
const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["completed", "cancelled"],
  rejected: [],
  cancelled: [],
  completed: [],
};

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const booking = await Booking.findById(req.validatedParams.id).populate("business", "name owner");
  if (!booking) throw ApiError.notFound("Booking not found");

  const isOwner = booking.business && String(booking.business.owner) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only manage bookings for your own business");
  }

  const allowed = ALLOWED_TRANSITIONS[booking.status] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      allowed.length === 0
        ? `This booking is ${booking.status} and can no longer be changed.`
        : `A ${booking.status} booking can only become: ${allowed.join(", ")}.`
    );
  }
  if (status === "completed" && booking.startAt > new Date()) {
    throw ApiError.badRequest("This appointment has not happened yet");
  }

  booking.status = status;
  if (note) booking.ownerNote = note;
  if (status === "confirmed") booking.confirmedAt = new Date();
  if (status === "completed") booking.completedAt = new Date();
  if (["rejected", "cancelled"].includes(status)) {
    // Frees the slot for someone else.
    booking.slotKey = undefined;
    booking.cancelledBy = "owner";
    booking.cancelledAt = new Date();
    booking.cancellationReason = note;
  }

  await booking.save();

  const when = formatDateTime(booking.startAt, booking.tzOffsetMinutes);
  const messages = {
    confirmed: {
      type: "booking_confirmed",
      title: "Booking confirmed",
      body: `${booking.business.name} confirmed your ${booking.service.name} on ${when}.`,
    },
    rejected: {
      type: "booking_rejected",
      title: "Booking declined",
      body: `${booking.business.name} could not take your ${booking.service.name} on ${when}${
        note ? `: ${note}` : "."
      }`,
    },
    cancelled: {
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: `${booking.business.name} cancelled your ${booking.service.name} on ${when}${note ? `: ${note}` : "."}`,
    },
    completed: {
      type: "booking_completed",
      title: "How did it go?",
      body: `Your ${booking.service.name} at ${booking.business.name} is marked complete. You can review it now.`,
    },
  };

  if (messages[status]) {
    await notify.create(booking.customer, {
      ...messages[status],
      link: "/bookings",
      data: { bookingId: String(booking._id), businessId: String(booking.business._id) },
    });
  }

  return ok(res, { message: `Booking ${status}`, booking: toPublicBooking(booking, { viewer: "owner" }) });
});
