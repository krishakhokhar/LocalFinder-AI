import "../config/loadEnv.js"; // must stay the first import - see the file

// Importing every model registers its schema so createIndexes() covers all.
import "../models/User.js";
import "../models/Business.js";
import "../models/Review.js";
import "../models/Booking.js";
import "../models/Favorite.js";
import "../models/Contact.js";
import "../models/Notification.js";
import "../models/Report.js";
import "../models/Category.js";
import "../models/AnalyticsEvent.js";

import mongoose from "mongoose";
import connectDB, { ensureIndexes } from "../config/db.js";
import { assertEnv } from "../config/env.js";

assertEnv();
await connectDB();
const created = await ensureIndexes();
console.log(`Indexes ensured for: ${created.join(", ")}`);
await mongoose.connection.close();
process.exit(0);
