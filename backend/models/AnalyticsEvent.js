import mongoose from "mongoose";

export const ANALYTICS_EVENT_TYPES = [
  "business_view",
  "business_call",
  "business_directions",
  "business_inquiry",
  "search",
  "ai_search",
  "booking_created",
];

/**
 * Append-only event log behind the dashboards. Deliberately thin: one small
 * document per event, aggregated on read. No personally identifying data is
 * stored beyond the (optional) user reference, and events expire after a
 * year.
 */
const analyticsEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ANALYTICS_EVENT_TYPES, required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    placeId: { type: String, trim: true },
    // "YYYY-MM-DD" (UTC) so day-bucketed aggregation needs no date maths.
    day: { type: String, required: true, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

analyticsEventSchema.index({ business: 1, type: 1, day: 1 });
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export default mongoose.model("AnalyticsEvent", analyticsEventSchema);
