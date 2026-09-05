import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import servicesRoutes from "./routes/servicesRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();
connectDB();

const app = express();

// ================= CORS ================= //

// Known-good origins that must always work, regardless of whether
// CORS_ORIGIN is configured on the hosting platform. CORS_ORIGIN can
// still be used to add further origins (e.g. a staging site) without
// a code change, but it extends this list rather than replacing it.
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://local-finder-ai.vercel.app",
];

const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins])];

// Vercel preview deployments for this project follow a predictable
// pattern under the same project/team scope, e.g.:
//   https://local-finder-ai-git-main-krishakhokhars-projects.vercel.app
//   https://local-finder-ai-<deployment-hash>-krishakhokhars-projects.vercel.app
// Matching this narrow, project-scoped pattern (never *.vercel.app in
// general) lets new preview URLs work automatically without needing a
// code change for every branch/deployment.
const VERCEL_PREVIEW_ORIGIN_REGEX =
  /^https:\/\/local-finder-ai-[a-z0-9-]+-krishakhokhars-projects\.vercel\.app$/;

function isOriginAllowed(origin) {
  return allowedOrigins.includes(origin) || VERCEL_PREVIEW_ORIGIN_REGEX.test(origin);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (curl, server-to-server, mobile apps)
      if (!origin || isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

// ================= ROUTES ================= //

app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/chat", chatRoutes);

// ================= HEALTH CHECK ================= //

app.get("/", (req, res) => {
  res.send("Backend running");
});

// ================= 404 HANDLER ================= //

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ================= CENTRAL ERROR HANDLER ================= //

app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, message: "CORS: origin not allowed" });
  }
  console.error(err);
  res.status(500).json({ success: false, message: "Server error" });
});

// ================= SERVER ================= //

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
