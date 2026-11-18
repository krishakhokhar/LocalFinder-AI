import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";

import apiRouter from "./routes/index.js";
import { env } from "./config/env.js";
import { sanitizeRequest } from "./middleware/sanitize.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("http");

// ================= CORS ================= //

// Known-good origins that must always work, regardless of whether
// CORS_ORIGIN is configured on the hosting platform. CORS_ORIGIN can
// still be used to add further origins (e.g. a staging site) without
// a code change, but it extends this list rather than replacing it.
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "https://local-finder-ai.vercel.app"];

// Vercel preview deployments for this project follow a predictable
// pattern under the same project/team scope, e.g.:
//   https://local-finder-ai-git-main-krishakhokhars-projects.vercel.app
// Matching this narrow, project-scoped pattern (never *.vercel.app in
// general) lets new preview URLs work automatically.
const VERCEL_PREVIEW_ORIGIN_REGEX =
  /^https:\/\/local-finder-ai-[a-z0-9-]+-krishakhokhars-projects\.vercel\.app$/;

/**
 * Any localhost port, development only.
 *
 * Vite does not guarantee port 5173: when it is already in use - a second
 * terminal, a dev server that did not shut down cleanly - it silently
 * moves to 5174, 5175 and so on. Pinning the allowlist to 5173 meant the
 * app then failed every request with a CORS rejection, which the browser
 * reports to JavaScript as a generic network failure, so the UI said
 * "check your internet connection" while the server was running fine.
 *
 * This is gated on NODE_ENV and never loosens production, where the
 * explicit list and the Vercel pattern still apply.
 */
const LOCALHOST_ORIGIN_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function buildCorsOptions() {
  const allowed = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...env.corsOrigins])];

  const isAllowed = (origin) =>
    allowed.includes(origin) ||
    VERCEL_PREVIEW_ORIGIN_REGEX.test(origin) ||
    (!env.isProduction && LOCALHOST_ORIGIN_REGEX.test(origin));

  return {
    origin: (origin, callback) => {
      // Requests with no Origin header (curl, server-to-server, native apps)
      // are not browser cross-origin requests and are allowed through.
      if (!origin || isAllowed(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: false,
    maxAge: 86400,
  };
}

/**
 * Builds the Express application without starting a listener or touching
 * the database, so tests and tooling can exercise the routing table
 * directly. server.js owns the process-level concerns.
 */
export function createApp() {
  // Applies whether or not connectDB() ran, so anything that builds the
  // app (tests, tooling) gets the same fail-fast behaviour.
  mongoose.set("bufferTimeoutMS", 2500);

  const app = express();

  // Render terminates TLS at its proxy; without this every client looks
  // like the proxy and rate limiting would be global rather than per IP.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // The API serves JSON and uploaded images, never HTML, so CSP would
      // only restrict assets that are consumed cross-origin by the SPA.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(sanitizeRequest);

  app.use(
    morgan(env.isProduction ? "combined" : "dev", {
      stream: { write: (line) => log.info(line.trimEnd()) },
      skip: (req) => req.path === "/health" || req.path === "/",
    })
  );

  // Locally stored uploads. In production UPLOAD_DRIVER=cloudinary should be
  // used instead - Render's filesystem does not survive a redeploy.
  app.use(
    "/uploads",
    express.static(path.resolve(process.cwd(), env.uploadDir), {
      maxAge: "7d",
      fallthrough: true,
      index: false,
    })
  );

  app.use("/api", generalLimiter, apiRouter);

  // Reports the database state too, so a platform health check can
  // distinguish "process alive" from "actually able to serve".
  app.get("/health", async (req, res) => {
    const { default: mongoose } = await import("mongoose");
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const database = states[mongoose.connection.readyState] || "unknown";

    res.status(database === "connected" ? 200 : 503).json({
      success: database === "connected",
      status: database === "connected" ? "ok" : "degraded",
      database,
      uptime: Math.round(process.uptime()),
    });
  });

  app.get("/", (req, res) => {
    res.send("Backend running");
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
