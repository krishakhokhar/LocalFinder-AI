import mongoose from "mongoose";

export const CONTACT_STATUSES = ["new", "in_progress", "closed"];

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [5, "Message must be at least 5 characters"],
      maxlength: 2000,
    },
    subject: { type: String, trim: true, maxlength: 140 },
    // Set when a signed-in user writes in, so support can see who it was.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Added for the admin inbox. Existing documents default to "new".
    status: { type: String, enum: CONTACT_STATUSES, default: "new", index: true },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date },
    internalNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

contactSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Contact", contactSchema);
