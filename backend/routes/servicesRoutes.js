import express from "express";
import { getNearbyServices, getCategories } from "../controllers/servicesController.js";
import { validateQuery } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { searchLimiter } from "../middleware/rateLimit.js";
import { nearbySearchSchema } from "../validators/searchSchemas.js";

const router = express.Router();

router.get("/categories", getCategories);
router.get("/nearby", searchLimiter, optionalAuth, validateQuery(nearbySearchSchema), getNearbyServices);

export default router;
