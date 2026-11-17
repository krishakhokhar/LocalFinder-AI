import express from "express";
import { createContact } from "../controllers/contactController.js";
import { validateBody } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { contactSchema } from "../validators/contactSchemas.js";

const router = express.Router();

router.post("/", writeLimiter, optionalAuth, validateBody(contactSchema), createContact);

export default router;
