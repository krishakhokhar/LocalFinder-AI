import express from "express";
import { aiSearch, aiCompare, aiStatus } from "../controllers/aiController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validate.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { aiSearchSchema, aiCompareSchema } from "../validators/aiSchemas.js";

const router = express.Router();

router.get("/status", aiStatus);
router.post("/search", aiLimiter, optionalAuth, validateBody(aiSearchSchema), aiSearch);
router.post("/compare", aiLimiter, optionalAuth, validateBody(aiCompareSchema), aiCompare);

export default router;
