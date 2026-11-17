import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Stable identifier for the underlying place - see utils/placeId.js.
    // The format is unchanged from the original app so favourites saved
    // before this release keep working.
    placeId: {
      type: String,
      required: [true, "placeId is required"],
      trim: true,
    },
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
    },
    category: { type: String, trim: true },
    lat: {
      type: Number,
      required: [true, "lat is required"],
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      required: [true, "lng is required"],
      min: -180,
      max: 180,
    },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    /**
     * DEPRECATED. Earlier versions wrote a randomly generated rating here.
     * Nothing writes this field any more and nothing reads it: ratings are
     * always computed live from the Review collection. The field is kept
     * only so existing documents remain valid - it is stripped on read.
     */
    rating: { type: String, trim: true },
    opening_hours: { type: String, trim: true },

    // Set for places registered on LocalFinder, so a favourite can link
    // straight to the rich business page.
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null },
    source: { type: String, enum: ["osm", "localfinder"], default: "osm" },
  },
  { timestamps: true }
);

// A user can only favorite the same place once.
favoriteSchema.index({ userId: 1, placeId: 1 }, { unique: true });

export default mongoose.model("Favorite", favoriteSchema);
