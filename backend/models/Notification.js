import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "booking_created",
  "booking_confirmed",
  "booking_rejected",
  "booking_cancelled",
  "booking_completed",
  "booking_reminder",
  "business_submitted",
  "business_approved",
  "business_rejected",
  "business_suspended",
  "review_received",
  "review_removed",
  "report_resolved",
  "account",
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "user is required"],
    },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, trim: true, maxlength: 500 },
    // In-app route the notification points at, e.g. "/bookings".
    link: { type: String, trim: true, maxlength: 300 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Drives both the inbox listing and the unread badge.
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
// Notifications are transient; 90 days is plenty and keeps the collection small.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("Notification", notificationSchema);
