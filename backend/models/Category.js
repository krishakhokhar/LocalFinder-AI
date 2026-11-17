import mongoose from "mongoose";

/**
 * Admin-managed catalogue of service categories. `key` matches the keys used
 * by the OSM tag map in utils/overpass.js so that one category drives both
 * registered-business filtering and external place search.
 */
const categorySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "key is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_-]{2,30}$/, "key must be lowercase letters, numbers, - or _"],
    },
    label: { type: String, required: [true, "label is required"], trim: true, maxlength: 60 },
    icon: { type: String, trim: true, default: "store" },
    description: { type: String, trim: true, maxlength: 300 },
    // Whether external OSM search supports this category. Admin-created
    // categories default to false - registered businesses only.
    supportsExternalSearch: { type: Boolean, default: false },
    order: { type: Number, default: 100 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ active: 1, order: 1 });

export default mongoose.model("Category", categorySchema);
