import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// 🔥 REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const exist = await User.findOne({ email });

    if (exist) {
      return res.status(400).json({
        success: false,
        message: "User already exists ❌",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = new User({ name, email, password: hash });
    await user.save();

    return res.status(201).json({
      success: true,
      message: "Registered successfully ✅",
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error ❌",
    });
  }
});

// 🔥 LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found ❌",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Wrong password ❌",
      });
    }

    const token = jwt.sign({ id: user._id }, "secretkey");

    return res.status(200).json({
      success: true,
      message: "Login success ✅",
      token,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error ❌",
    });
  }
});

export default router;