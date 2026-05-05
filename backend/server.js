import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import connectDB from "./config/db.js";
import User from "./models/User.js";
import Service from "./models/Service.js"; // 🔥 NEW


dotenv.config();
connectDB();

const app = express();

app.use(cors());
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

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "Email already exists ❌" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    res.json({ success: true, message: "Signup successful ✅" });

  } catch (error) {
    res.json({ success: false, message: "Error ❌" });
  }
});


app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "User not found ❌" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({ success: false, message: "Wrong password ❌" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      message: "Login successful ✅",
      token,
    });

  } catch (error) {
    res.json({ success: false, message: "Error ❌" });
  }
});


// ================= 🔥 NEARBY API (DYNAMIC) ================= //

app.get("/nearby", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const services = await Service.find();

    const result = services.map((s) => {
      const dist = getDistance(
        lat,
        lng,
        s.lat,
        s.lng
      );

      return {
        name: s.name,
        type: s.type,
        rating: s.rating,
        distance: dist.toFixed(2) + " km",
        position: [s.lat, s.lng],
      };
    });

    result.sort(
      (a, b) => parseFloat(a.distance) - parseFloat(b.distance)
    );

    res.json({ services: result });

  } catch (err) {
    res.json({ services: [] });
  }
});


// ================= 🔥 SEED DATA (ONE TIME) ================= //

app.get("/seed", async (req, res) => {
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

  res.send("Data inserted ✅");
});


// ================= AI CHAT ================= //

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message.toLowerCase();

    let type = null;

    if (userMessage.includes("salon")) type = "salon";
    else if (userMessage.includes("plumber")) type = "plumber";
    else if (userMessage.includes("electrician")) type = "electrician";

    // 🔥 अब DB से fetch
    let matchedServices = [];
    if (type) {
      matchedServices = await Service.find({ type });
    }

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
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

    res.json({
      reply,
      services: matchedServices.map((s) => ({
        name: s.name,
        rating: s.rating,
        distance: "Nearby",
        position: [s.lat, s.lng],
      })),
    });

  } catch (error) {
    res.json({
      reply: "AI error ❌",
      services: [],
    });
  }
});


// ================= TEST ================= //

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});


// ================= SERVER ================= //

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
app.get("/nearby", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    const services = await Service.find();

    const result = services.map((s) => {
      const dist = getDistance(
        lat,
        lng,
        s.lat,
        s.lng
      );

      return {
        name: s.name,
        type: s.type,
        rating: s.rating,
        distance: dist.toFixed(2) + " km",
        position: [s.lat, s.lng],
      };
    });

    result.sort(
      (a, b) => parseFloat(a.distance) - parseFloat(b.distance)
    );

    res.json({ services: result });

  } catch (err) {
    res.json({ services: [] });
  }
});