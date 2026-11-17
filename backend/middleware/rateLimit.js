import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/**
 * Rate limiting.
 *
 * Limits are per IP and deliberately tiered: a brute-force attempt against
 * login and an expensive AI call must not share a budget with ordinary page
 * reads. All of them return the same JSON envelope the rest of the API uses
 * so the frontend can surface them like any other error.
 *
 * `app.set("trust proxy", 1)` is required for these to key on the real
 * client IP behind Render's proxy - that is done in app.js.
 */
function limiter({ windowMs, max, message, skipSuccessful = false }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: skipSuccessful,
    // Local development would otherwise trip limits while hot-reloading.
    skip: () => !env.isProduction && process.env.ENABLE_RATE_LIMIT !== "true",
    handler: (req, res) => {
      res.status(429).json({ success: false, message, code: "RATE_LIMITED" });
    },
  });
}

/** Broad backstop for the whole API surface. */
export const generalLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: "Too many requests. Please slow down and try again shortly.",
});

/** Login/register: counts only failures, so a legitimate user is never locked out. */
export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessful: true,
  message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
});

/** Groq calls cost money and upstream quota. */
export const aiLimiter = limiter({
  windowMs: 60 * 1000,
  max: 12,
  message: "You are sending messages too quickly. Please wait a moment.",
});

/** Outbound OSM traffic - protects us and respects their usage policy. */
export const searchLimiter = limiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many searches in a short time. Please wait a few seconds.",
});

/** Anything that creates content: reviews, bookings, reports, contact. */
export const writeLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  max: 40,
  message: "Too many submissions. Please try again in a few minutes.",
});

export const uploadLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many uploads. Please try again in a few minutes.",
});
