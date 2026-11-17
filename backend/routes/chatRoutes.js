import express from "express";
import { sendMessage } from "../controllers/chatController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { aiLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/", aiLimiter, optionalAuth, sendMessage);

export default router;
