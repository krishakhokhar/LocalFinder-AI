import mongoose from "mongoose";

export const REVIEW_STATUSES = ["published", "hidden", "removed"];

/**
 * A review targets a *place*, identified by the same `placeId` the rest of
 * the app uses. That keeps one review model for both kinds of place:
 *
 *   - businesses registered on LocalFinder  -> `business` is set
 *   - places that only exist in OpenStreetMap -> `business` is null
 *
 * Ratings shown anywhere in the product are computed from these documents
 * and nothing else. There is no other source of ratings in the system.
 */
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "user is required"],
      index: true,
    },
    placeId: { type: String, required: [true, "placeId is required"], trim: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },

    // Denormalised so a review stays readable (in moderation queues, in a
    // user's own list) even if the OSM place later disappears.
    placeName: { type: String, required: [true, "placeName is required"], trim: true, maxlength: 140 },
    placeSource: { type: String, enum: ["localfinder", "osm"], default: "osm" },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },

    rating: {
      type: Number,
      required: [true, "rating is required"],
      min: [1, "rating must be between 1 and 5"],
      max: [5, "rating must be between 1 and 5"],
      validate: {
        validator: Number.isInteger,
        message: "rating must be a whole number from 1 to 5",
      },
    },
    comment: { type: String, trim: true, maxlength: 1500 },
    photos: {
      type: [String],
      default: [],
      validate: [(value) => value.length <= 5, "At most 5 photos per review"],
    },

    // Set only when the reviewer actually completed a booking here.
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    verifiedBooking: { type: Boolean, default: false },

    status: { type: String, enum: REVIEW_STATUSES, default: "published", index: true },
    moderationNote: { type: String, trim: true, maxlength: 500 },
    reportCount: { type: Number, default: 0, min: 0 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One review per user per place. Edits update the existing document.
reviewSchema.index({ user: 1, placeId: 1 }, { unique: true });
reviewSchema.index({ placeId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, reportCount: -1 });

/**
 * Recomputes a business's denormalised rating from the reviews themselves.
 * Static (not an instance method) so moderation actions and deletes can call
 * it without loading the review again.
 */
reviewSchema.statics.syncBusinessRating = async function syncBusinessRating(businessId) {
  if (!businessId) return;
  const Review = this;
  const [summary] = await Review.aggregate([
    { $match: { business: new mongoose.Types.ObjectId(String(businessId)), status: "published" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  await mongoose.model("Business").findByIdAndUpdate(businessId, {
    ratingAvg: summary ? Math.round(summary.avg * 10) / 10 : 0,
    ratingCount: summary ? summary.count : 0,
  });
};

/**
 * Aggregate ratings for a batch of placeIds in one round trip. Used by the
 * search pipeline so a list of 30 results costs one extra query, not 30.
 */
reviewSchema.statics.summaryForPlaceIds = async function summaryForPlaceIds(placeIds) {
  const unique = [...new Set((placeIds || []).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await this.aggregate([
    { $match: { placeId: { $in: unique }, status: "published" } },
    { $group: { _id: "$placeId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  return new Map(
    rows.map((row) => [row._id, { rating: Math.round(row.avg * 10) / 10, ratingCount: row.count }])
  );
};

async function syncAfterWrite(doc) {
  if (doc?.business) {
    await mongoose.model("Review").syncBusinessRating(doc.business);
  }
}

reviewSchema.post("save", syncAfterWrite);
reviewSchema.post("findOneAndUpdate", syncAfterWrite);
reviewSchema.post("findOneAndDelete", syncAfterWrite);
reviewSchema.post("deleteOne", { document: true, query: false }, syncAfterWrite);

export default mongoose.model("Review", reviewSchema);
