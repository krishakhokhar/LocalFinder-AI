import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verifies the JWT *and* loads the user.
 *
 * Loading the user on every authenticated request costs one indexed lookup
 * and is what makes role changes, deactivation and deletion take effect
 * immediately. Trusting a role claim baked into a week-old token would mean
 * a demoted admin keeps admin powers until their token expires.
 *
 * `req.userId` is still set, unchanged, so existing controllers keep working.
 */
export const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized("Not authorized, no token provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized("Not authorized, invalid or expired token");
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw ApiError.unauthorized("Account no longer exists");
  }
  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated. Contact support.");
  }

  req.user = user;
  req.userId = user._id;
  next();
});

/**
 * Attaches the user when a valid token is present and otherwise continues
 * anonymously. Used by endpoints that work signed out but return extra
 * information when signed in (e.g. "have I already reviewed this place").
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
    }
  } catch {
    // An invalid token on an optional-auth route is simply anonymous.
  }
  next();
});

/**
 * Role gate. Always applied on the server - hiding a button in React is a
 * UI nicety, not access control.
 *
 *   router.get("/admin/users", protect, requireRole("admin"), handler)
 */
export function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires one of: ${allowed.join(", ")}`));
    }
    next();
  };
}

export default protect;
