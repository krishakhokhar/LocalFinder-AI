import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { ApiError, ok, created } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const BCRYPT_ROUNDS = 12;

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

/**
 * Registration.
 *
 * Unlike the previous version this signs the user in immediately (returning
 * a token), which removes the "registered, now log in again" step, and it
 * returns the user object so the client never has to guess the role.
 */
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, city } = req.body;

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role === "owner" ? "owner" : "customer",
    phone,
    city,
  });

  return created(res, {
    message: "Registered successfully",
    token: signToken(user),
    user: user.toPublic(),
  });
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // `password` is select:false on the schema, so it has to be asked for.
  const user = await User.findOne({ email }).select("+password");

  // Comparing against a dummy hash when the user does not exist keeps the
  // response time roughly constant, so the endpoint does not reveal which
  // emails are registered.
  const hash = user?.password || "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const isMatch = await bcrypt.compare(password, hash);

  if (!user || !isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }
  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated. Contact support.");
  }

  user.lastLoginAt = new Date();
  await user.save();

  return ok(res, {
    message: "Login successful",
    token: signToken(user),
    user: user.toPublic(),
  });
});

export const getMe = asyncHandler(async (req, res) => {
  return ok(res, { user: req.user.toPublic() });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, city, avatarUrl } = req.body;
  const user = req.user;

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone || undefined;
  if (city !== undefined) user.city = city || undefined;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || undefined;

  await user.save();
  return ok(res, { message: "Profile updated", user: user.toPublic() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw ApiError.badRequest("Your current password is incorrect");
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  // The existing token stays valid until it expires. Returning a fresh one
  // lets the client replace it so the session restarts cleanly.
  return ok(res, { message: "Password changed", token: signToken(user) });
});

/**
 * Lets an existing customer start listing a business. Upgrading in place
 * (rather than making them create a second account) keeps their favourites,
 * reviews and bookings attached to one identity.
 */
export const becomeOwner = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.role === "admin") {
    throw ApiError.badRequest("Admins already have full access");
  }
  if (user.role !== "owner") {
    user.role = "owner";
  }
  user.phone = req.body.phone;
  await user.save();

  return ok(res, { message: "You can now list your business", user: user.toPublic() });
});
