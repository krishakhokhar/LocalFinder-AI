import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/apiResponse.js";
import { createLogger } from "../utils/logger.js";
import { env } from "../config/env.js";

const log = createLogger("error");

export function notFound(req, res) {
  res.status(404).json({ success: false, message: "Route not found", code: "NOT_FOUND" });
}

/**
 * Single place where every failure becomes a response.
 *
 * Two rules it exists to enforce:
 *  1. Clients get a useful, specific message for anything they can fix
 *     (validation, duplicates, permissions).
 *  2. Nothing internal leaks for anything they cannot - an unexpected error
 *     is logged in full on the server and reported as a generic 500, with
 *     the stack included only outside production.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, message: "CORS: origin not allowed", code: "CORS" });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: err.issues[0]?.message || "Invalid input",
      code: "VALIDATION_ERROR",
      errors: err.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    });
  }

  if (err?.name === "ValidationError" && err.errors) {
    const errors = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    return res.status(400).json({
      success: false,
      message: errors[0]?.message || "Invalid input",
      code: "VALIDATION_ERROR",
      errors,
    });
  }

  /**
   * The database is unreachable.
   *
   * Mongoose buffers commands while disconnected and rejects them when
   * `bufferTimeoutMS` elapses; a dropped connection mid-query surfaces
   * as a MongoNetworkError or a server-selection failure. All of these
   * mean the same thing to a client - the service cannot serve right
   * now - so they become an explicit 503 rather than a generic 500 that
   * looks like a bug in the endpoint.
   *
   * This is handled here rather than by a guard in front of the router
   * so that cheap rejections still work during an outage: a request
   * with no token is still a 401, and invalid input is still a 400,
   * because neither needs the database to answer.
   */
  const unreachable =
    err?.name === "MongoNetworkError" ||
    err?.name === "MongooseServerSelectionError" ||
    err?.name === "MongoServerSelectionError" ||
    /buffering timed out|failed to connect|connection .* closed|topology/i.test(err?.message || "");

  if (unreachable) {
    log.error(`${req.method} ${req.originalUrl}: database unreachable - ${err.message}`);
    res.set("Retry-After", "30");
    return res.status(503).json({
      success: false,
      message: "The service is temporarily unavailable. Please try again in a moment.",
      code: "DATABASE_UNAVAILABLE",
    });
  }

  if (err?.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${err.path}`,
      code: "INVALID_ID",
    });
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(", ") || "value";
    return res.status(409).json({
      success: false,
      message: `That ${field} is already taken.`,
      code: "DUPLICATE",
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "That file is too large."
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Too many files, or an unexpected field name."
          : "Upload failed.";
    return res.status(400).json({ success: false, message, code: err.code });
  }

  log.error(`${req.method} ${req.originalUrl} failed`, err);
  return res.status(err?.status || 500).json({
    success: false,
    message: "Server error",
    code: "INTERNAL",
    ...(env.isProduction ? {} : { detail: err?.message, stack: err?.stack?.split("\n").slice(0, 4) }),
  });
}
