import mongoose from "mongoose";

export const REPORT_TARGETS = ["review", "business"];
export const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"];
export const REPORT_REASONS = [
  "spam",
  "offensive",
  "fake",
  "wrong_information",
  "not_a_real_business",
  "other",
];

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "reporter is required"],
      index: true,
    },
    targetType: { type: String, enum: REPORT_TARGETS, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Human-readable snapshot so the moderation queue reads well even after
    // the target is removed.
    targetLabel: { type: String, trim: true, maxlength: 200 },

    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 1000 },

    status: { type: String, enum: REPORT_STATUSES, default: "open", index: true },
    resolution: { type: String, trim: true, maxlength: 500 },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    handledAt: { type: Date },
  },
  { timestamps: true }
);

// A user may report a given item only once.
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Report", reportSchema);
