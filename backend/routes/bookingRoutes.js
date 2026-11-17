import express from "express";
import {
  getAvailability,
  createBooking,
  myBookings,
  cancelBooking,
  rescheduleBooking,
  businessBookings,
  updateBookingStatus,
} from "../controllers/bookingController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import {
  availabilitySchema,
  createBookingSchema,
  rescheduleSchema,
  cancelSchema,
  statusSchema,
  bookingIdParamSchema,
  myBookingsSchema,
  businessBookingsSchema,
} from "../validators/bookingSchemas.js";
import { businessIdParamSchema } from "../validators/businessSchemas.js";

const router = express.Router();

// Availability is public: someone should be able to see whether a
// business has free slots before being asked to create an account.
router.get("/availability", validateQuery(availabilitySchema), getAvailability);

router.use(protect);

router.get("/mine", validateQuery(myBookingsSchema), myBookings);
router.post("/", writeLimiter, validateBody(createBookingSchema), createBooking);

router.post(
  "/:id/cancel",
  validateParams(bookingIdParamSchema),
  validateBody(cancelSchema),
  cancelBooking
);
router.post(
  "/:id/reschedule",
  writeLimiter,
  validateParams(bookingIdParamSchema),
  validateBody(rescheduleSchema),
  rescheduleBooking
);

router.get(
  "/business/:id",
  requireRole("owner", "admin"),
  validateParams(businessIdParamSchema),
  validateQuery(businessBookingsSchema),
  businessBookings
);
router.patch(
  "/:id/status",
  requireRole("owner", "admin"),
  validateParams(bookingIdParamSchema),
  validateBody(statusSchema),
  updateBookingStatus
);

export default router;
