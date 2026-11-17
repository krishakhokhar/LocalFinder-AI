import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import { assertEnv } from "../config/env.js";
import User from "../models/User.js";

/**
 * Creates (or promotes) the platform administrator.
 *
 * Admins deliberately cannot be created through the public API - this
 * script is the only way to make the first one, and existing admins can
 * promote others from the dashboard afterwards.
 *
 *   node scripts/createAdmin.js "Krisha" admin@example.com "StrongPass123"
 */
const [, , nameArg, emailArg, passwordArg] = process.argv;

if (!emailArg || !passwordArg) {
  console.error('Usage: node scripts/createAdmin.js "<name>" <email> <password>');
  process.exit(1);
}
if (passwordArg.length < 8) {
  console.error("Choose a password of at least 8 characters for an admin account.");
  process.exit(1);
}

assertEnv();
await connectDB();

const email = emailArg.trim().toLowerCase();
const existing = await User.findOne({ email });

if (existing) {
  existing.role = "admin";
  existing.isActive = true;
  existing.password = await bcrypt.hash(passwordArg, 12);
  await existing.save();
  console.log(`Existing account ${email} promoted to admin and password reset.`);
} else {
  await User.create({
    name: nameArg || "Administrator",
    email,
    password: await bcrypt.hash(passwordArg, 12),
    role: "admin",
  });
  console.log(`Admin account created: ${email}`);
}

await mongoose.connection.close();
process.exit(0);
