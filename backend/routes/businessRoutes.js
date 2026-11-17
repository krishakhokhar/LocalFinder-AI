import express from "express";
import { z } from "zod";
import {
  listBusinesses,
  getBusiness,
  myBusinesses,
  createBusiness,
  updateBusiness,
  submitBusiness,
  updateBookingSettings,
  setOpeningHours,
  addService,
  updateService,
  removeService,
  deleteBusiness,
  recordInteraction,
} from "../controllers/businessController.js";
import { protect, optionalAuth, requireRole } from "../middleware/authMiddleware.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import {
  businessIdParamSchema,
  serviceIdParamSchema,
  createBusinessSchema,
  updateBusinessSchema,
  bookingSettingsSchema,
  openingHoursSchema,
  serviceSchema,
  listBusinessesSchema,
} from "../validators/businessSchemas.js";

const router = express.Router();

/* ---------------------------------------------------------------- owner --
 * Declared before "/:id" so the literal path is not swallowed by the
 * parameterised one.
 * ------------------------------------------------------------------------ */
router.get("/mine", protect, requireRole("owner", "admin"), myBusinesses);

router.post(
  "/",
  protect,
  requireRole("owner", "admin"),
  writeLimiter,
  validateBody(createBusinessSchema),
  createBusiness
);

/* --------------------------------------------------------------- public -- */
router.get("/", validateQuery(listBusinessesSchema), listBusinesses);
router.get("/:id", optionalAuth, validateParams(businessIdParamSchema), getBusiness);

router.post(
  "/:id/interaction",
  optionalAuth,
  validateParams(businessIdParamSchema),
  validateBody(z.object({ type: z.enum(["call", "directions", "inquiry"]) })),
  recordInteraction
);

/* ------------------------------------------------------- owner mutations --
 * Ownership is re-checked inside every handler against the loaded
 * document, not inferred from the role alone.
 * ------------------------------------------------------------------------ */
router.use(protect, requireRole("owner", "admin"));

router.patch("/:id", validateParams(businessIdParamSchema), validateBody(updateBusinessSchema), updateBusiness);
router.delete("/:id", validateParams(businessIdParamSchema), deleteBusiness);

router.post("/:id/submit", writeLimiter, validateParams(businessIdParamSchema), submitBusiness);

router.patch(
  "/:id/booking-settings",
  validateParams(businessIdParamSchema),
  validateBody(bookingSettingsSchema),
  updateBookingSettings
);

router.put(
  "/:id/hours",
  validateParams(businessIdParamSchema),
  validateBody(z.object({ openingHours: openingHoursSchema })),
  setOpeningHours
);

router.post(
  "/:id/services",
  validateParams(businessIdParamSchema),
  validateBody(serviceSchema),
  addService
);
router.patch(
  "/:id/services/:serviceId",
  validateParams(serviceIdParamSchema),
  validateBody(serviceSchema.partial()),
  updateService
);
router.delete("/:id/services/:serviceId", validateParams(serviceIdParamSchema), removeService);

export default router;
