import mongoose from "mongoose";

export const USER_ROLES = ["customer", "owner", "admin"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "customer",
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 20 },
    avatarUrl: { type: String, trim: true },
    city: { type: String, trim: true, maxlength: 100 },
    isActive: { type: Boolean, default: true },
    suspendedReason: { type: String, trim: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone || null,
    avatarUrl: this.avatarUrl || null,
    city: this.city || null,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("User", userSchema);
