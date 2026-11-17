import express from "express";
import { z } from "zod";
import { overview, businessAnalytics, businessReviews } from "../controllers/ownerController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import { businessIdParamSchema } from "../validators/businessSchemas.js";

const router = express.Router();

// Role is checked here and ownership is re-checked per document inside
// each handler - a business owner is not automatically allowed to read
// another owner's numbers.
router.use(protect, requireRole("owner", "admin"));

router.get("/overview", overview);

router.get(
  "/businesses/:id/analytics",
  validateParams(businessIdParamSchema),
  validateQuery(z.object({ days: z.coerce.number().int().min(7).max(90).optional().default(30) })),
  businessAnalytics
);

router.get("/businesses/:id/reviews", validateParams(businessIdParamSchema), businessReviews);

export default router;
