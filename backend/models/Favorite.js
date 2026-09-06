import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Stable identifier for the underlying place (built from name + coordinates
    // on the frontend) - used to prevent the same user favoriting the same
    // place twice, regardless of which provider (Overpass/Nominatim) it came from.
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
    rating: { type: String, trim: true },
    opening_hours: { type: String, trim: true },
  },
  { timestamps: true }
);

// A user can only favorite the same place once.
favoriteSchema.index({ userId: 1, placeId: 1 }, { unique: true });

export default mongoose.model("Favorite", favoriteSchema);
