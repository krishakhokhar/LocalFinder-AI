import express from "express";

import authRoutes from "./authRoutes.js";
import contactRoutes from "./contactRoutes.js";
import servicesRoutes from "./servicesRoutes.js";
import chatRoutes from "./chatRoutes.js";
import favoritesRoutes from "./favoritesRoutes.js";
import businessRoutes from "./businessRoutes.js";
import aiRoutes from "./aiRoutes.js";
import reviewRoutes from "./reviewRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import ownerRoutes from "./ownerRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import adminRoutes from "./adminRoutes.js";

/**
 * Single mount point for the API. Keeping the table in one file makes the
 * whole surface greppable and keeps app.js about transport concerns only.
 */
const router = express.Router();

router.use("/auth", authRoutes);
router.use("/contact", contactRoutes);
router.use("/services", servicesRoutes);
router.use("/chat", chatRoutes);
router.use("/favorites", favoritesRoutes);
router.use("/businesses", businessRoutes);
router.use("/ai", aiRoutes);
router.use("/reviews", reviewRoutes);
router.use("/uploads", uploadRoutes);
router.use("/owner", ownerRoutes);
router.use("/bookings", bookingRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin", adminRoutes);

export default router;
