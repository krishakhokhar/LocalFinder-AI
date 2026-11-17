import express from "express";
import { z } from "zod";
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  removeNotification,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { objectIdSchema } from "../validators/searchSchemas.js";

const router = express.Router();

router.use(protect);

router.get(
  "/",
  validateQuery(
    z.object({
      page: z.coerce.number().int().min(1).max(200).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      unreadOnly: z.preprocess((value) => value === "true" || value === true, z.boolean()).default(false),
    })
  ),
  listNotifications
);

router.get("/unread-count", unreadCount);
router.post("/read-all", markAllRead);
router.post("/:id/read", validateParams(z.object({ id: objectIdSchema })), markRead);
router.delete("/:id", validateParams(z.object({ id: objectIdSchema })), removeNotification);

export default router;
