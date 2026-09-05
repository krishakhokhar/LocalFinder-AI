import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Type is required"],
      trim: true,
      lowercase: true,
    },
    lat: {
      type: Number,
      required: [true, "Latitude is required"],
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      required: [true, "Longitude is required"],
      min: -180,
      max: 180,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
