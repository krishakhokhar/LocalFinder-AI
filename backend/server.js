import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

import connectDB from "./config/db.js";
import Service from "./models/Service.js";
import authRoutes from "./routes/authRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import servicesRoutes from "./routes/servicesRoutes.js";
import protect from "./middleware/authMiddleware.js";

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

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (curl, server-to-server, mobile apps)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

// ================= DISTANCE FUNCTION ================= //

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ================= AUTH ================= //

app.use("/api/auth", authRoutes);

// ================= CONTACT ================= //

app.use("/api/contact", contactRoutes);

// ================= NEARBY SERVICES (OVERPASS PROXY) ================= //

app.use("/api/services", servicesRoutes);

// ================= NEARBY (DYNAMIC, DB-BACKED) ================= //

app.get("/nearby", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: "Valid lat and lng query parameters are required",
        services: [],
      });
    }

    const services = await Service.find();

    const result = services
      .map((s) => {
        const dist = getDistance(lat, lng, s.lat, s.lng);
        return {
          name: s.name,
          type: s.type,
          rating: s.rating,
          distance: dist.toFixed(2) + " km",
          position: [s.lat, s.lng],
        };
      })
      .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

    return res.status(200).json({ success: true, services: result });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch nearby services",
      services: [],
    });
  }
});

// ================= SEED DATA (PROTECTED, ONE TIME) ================= //

app.get("/seed", protect, async (req, res) => {
  try {
    await Service.insertMany([
      {
        name: "Law Garden Salon",
        type: "salon",
        lat: 23.0225,
        lng: 72.5714,
        rating: 4.5,
      },
      {
        name: "Maninagar Plumber",
        type: "plumber",
        lat: 22.9967,
        lng: 72.599,
        rating: 4.6,
      },
      {
        name: "Satellite Electrician",
        type: "electrician",
        lat: 23.0264,
        lng: 72.5247,
        rating: 4.3,
      },
    ]);

    return res.status(201).json({ success: true, message: "Data inserted" });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to seed data",
    });
  }
});

// ================= AI CHAT ================= //

app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        reply: "Please enter a message.",
        services: [],
      });
    }

    const userMessage = message.toLowerCase();

    let type = null;
    if (userMessage.includes("salon")) type = "salon";
    else if (userMessage.includes("plumber")) type = "plumber";
    else if (userMessage.includes("electrician")) type = "electrician";

    let matchedServices = [];
    if (type) {
      matchedServices = await Service.find({ type });
    }

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant for a local service finder.",
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply =
      aiResponse.data?.choices?.[0]?.message?.content ||
      "Here are some services for you.";

    return res.status(200).json({
      success: true,
      reply,
      services: matchedServices.map((s) => ({
        name: s.name,
        rating: s.rating,
        distance: "Nearby",
        position: [s.lat, s.lng],
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      reply: "AI error, please try again later.",
      services: [],
    });
  }
});

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
