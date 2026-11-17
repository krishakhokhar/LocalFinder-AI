import mongoose from "mongoose";

export const BOOKING_STATUSES = ["pending", "confirmed", "rejected", "cancelled", "completed"];

/** Statuses that still occupy a slot. Anything else frees it. */
export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "completed"];

/**
 * Double booking is prevented by the database, not by application logic.
 *
 * `slotKey` is `<businessId>|<ISO start>|<seat>` and carries a unique index.
 * It is present only while the booking occupies the slot and is unset the
 * moment the booking is cancelled or rejected, which frees the slot again.
 * A sparse unique index ignores documents where the field is absent, so
 * freed slots never collide. Two concurrent requests for the same slot can
 * therefore never both succeed: one of them gets a duplicate-key error.
 *
 * `seat` exists because a business may serve several customers at once
 * (capacityPerSlot). Seat 0 is taken first, then 1, and so on.
 */
const bookingSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "business is required"],
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "customer is required"],
      index: true,
    },

    // Snapshot of the service as booked: the owner may later rename or
    // reprice it, and a past booking must still show what was agreed.
    service: {
      serviceId: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String, required: [true, "service name is required"], trim: true, maxlength: 120 },
      durationMinutes: { type: Number, required: true, min: 5, max: 600 },
      price: { type: Number, min: 0, default: null },
      currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "INR" },
    },

    startAt: { type: Date, required: [true, "startAt is required"], index: true },
    endAt: { type: Date, required: [true, "endAt is required"] },
    // Offset from UTC, in minutes, of the business's local time as used when
    // the slot was generated. Stored so the booking can always be rendered
    // in the same local time it was made in.
    tzOffsetMinutes: { type: Number, default: 0, min: -840, max: 840 },

    seat: { type: Number, default: 0, min: 0, max: 19 },
    slotKey: { type: String, default: undefined },

    status: { type: String, enum: BOOKING_STATUSES, default: "pending", index: true },

    contact: {
      name: { type: String, trim: true, maxlength: 100 },
      phone: { type: String, trim: true, maxlength: 20 },
      email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    },
    customerNote: { type: String, trim: true, maxlength: 500 },
    ownerNote: { type: String, trim: true, maxlength: 500 },

    cancelledBy: { type: String, enum: ["customer", "owner", "admin", null], default: null },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, maxlength: 300 },
    confirmedAt: { type: Date },
    completedAt: { type: Date },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bookingSchema.index({ slotKey: 1 }, { unique: true, sparse: true });
bookingSchema.index({ business: 1, startAt: 1, status: 1 });
bookingSchema.index({ customer: 1, startAt: -1 });
// Supports the reminder sweep without scanning the collection.
bookingSchema.index({ status: 1, startAt: 1, reminderSentAt: 1 });

export function buildSlotKey(businessId, startAt, seat = 0) {
  return `${String(businessId)}|${new Date(startAt).toISOString()}|${seat}`;
}

bookingSchema.statics.buildSlotKey = buildSlotKey;

export default mongoose.model("Booking", bookingSchema);
