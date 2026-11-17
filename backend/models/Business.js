import mongoose from "mongoose";

export const BUSINESS_STATUSES = ["draft", "pending", "approved", "rejected", "suspended"];

/**
 * A bookable/offered service. Embedded rather than a separate collection:
 * services are always read and written together with their business, are
 * few in number, and have no independent lifecycle.
 */
const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Service name is required"], trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    durationMinutes: { type: Number, min: 5, max: 600, default: 30 },
    // Price is optional on purpose - an unpriced service shows "Price on
    // request" rather than a made-up number.
    price: { type: Number, min: 0, max: 10000000, default: null },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "INR" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** One row per weekday. `closed` is explicit so "unknown" never reads as "closed". */
const hoursSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    closed: { type: Boolean, default: false },
    open: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, "open must be HH:MM"], default: "09:00" },
    close: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, "close must be HH:MM"], default: "18:00" },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "owner is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
      minlength: 2,
      maxlength: 140,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 2000 },

    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    website: { type: String, trim: true, maxlength: 300 },

    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      area: { type: String, trim: true, maxlength: 120 },
      city: { type: String, trim: true, maxlength: 100, index: true },
      state: { type: String, trim: true, maxlength: 100 },
      pincode: { type: String, trim: true, maxlength: 12 },
      country: { type: String, trim: true, maxlength: 80, default: "India" },
    },

    // GeoJSON Point [lng, lat] - the order a 2dsphere index requires.
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: {
        type: [Number],
        required: [true, "Location coordinates are required"],
        validate: {
          validator: (value) =>
            Array.isArray(value) &&
            value.length === 2 &&
            value[0] >= -180 &&
            value[0] <= 180 &&
            value[1] >= -90 &&
            value[1] <= 90,
          message: "coordinates must be [longitude, latitude] within valid ranges",
        },
      },
    },

    logoUrl: { type: String, trim: true },
    gallery: {
      type: [String],
      default: [],
      validate: [(value) => value.length <= 12, "At most 12 gallery images"],
    },

    openingHours: { type: [hoursSchema], default: [] },
    services: { type: [serviceSchema], default: [] },
    amenities: { type: [String], default: [] },

    // 1-4, the familiar price-band convention. null when the owner has not
    // said - never inferred.
    priceRange: { type: Number, min: 1, max: 4, default: null },

    status: { type: String, enum: BUSINESS_STATUSES, default: "draft", index: true },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    // Only an admin approval sets this. Nothing else may write it.
    verified: { type: Boolean, default: false },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    acceptsBookings: { type: Boolean, default: false },
    bookingSettings: {
      slotMinutes: { type: Number, min: 10, max: 240, default: 30 },
      leadTimeMinutes: { type: Number, min: 0, max: 10080, default: 60 },
      maxAdvanceDays: { type: Number, min: 1, max: 180, default: 30 },
      capacityPerSlot: { type: Number, min: 1, max: 20, default: 1 },
      autoConfirm: { type: Boolean, default: false },
    },

    // Denormalised aggregates, recomputed from the Review collection by
    // Review's own hooks. Never written by hand.
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },

    viewCount: { type: Number, default: 0 },
    inquiryCount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

businessSchema.index({ location: "2dsphere" });
businessSchema.index({ status: 1, category: 1 });
businessSchema.index({ status: 1, ratingAvg: -1 });
businessSchema.index({ name: "text", description: "text", "address.city": "text" });

/** Share of the fields that matter for discoverability, 0-100. */
businessSchema.virtual("profileCompletion").get(function profileCompletion() {
  const checks = [
    Boolean(this.name),
    Boolean(this.category),
    Boolean(this.description && this.description.length >= 40),
    Boolean(this.phone),
    Boolean(this.address?.line1 && this.address?.city),
    Array.isArray(this.location?.coordinates) && this.location.coordinates.length === 2,
    Boolean(this.logoUrl),
    Array.isArray(this.gallery) && this.gallery.length > 0,
    Array.isArray(this.openingHours) && this.openingHours.length === 7,
    Array.isArray(this.services) && this.services.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
});

businessSchema.virtual("lat").get(function lat() {
  return this.location?.coordinates?.[1] ?? null;
});
businessSchema.virtual("lng").get(function lng() {
  return this.location?.coordinates?.[0] ?? null;
});

export default mongoose.model("Business", businessSchema);
