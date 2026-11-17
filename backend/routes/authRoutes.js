import express from "express";
import {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  changePassword,
  becomeOwner,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validate.js";
import { authLimiter, writeLimiter } from "../middleware/rateLimit.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  becomeOwnerSchema,
} from "../validators/authSchemas.js";

const router = express.Router();

router.post("/register", authLimiter, validateBody(registerSchema), registerUser);
router.post("/login", authLimiter, validateBody(loginSchema), loginUser);

router.get("/me", protect, getMe);
router.patch("/me", protect, writeLimiter, validateBody(updateProfileSchema), updateMe);
router.post("/change-password", protect, authLimiter, validateBody(changePasswordSchema), changePassword);
router.post("/become-owner", protect, writeLimiter, validateBody(becomeOwnerSchema), becomeOwner);

export default router;
