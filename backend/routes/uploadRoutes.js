import express from "express";
import { uploadImages } from "../controllers/uploadController.js";
import { protect } from "../middleware/authMiddleware.js";
import { imageUpload, verifyImageBytes } from "../middleware/upload.js";
import { uploadLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post(
  "/images",
  protect,
  uploadLimiter,
  imageUpload.array("images", 6),
  verifyImageBytes,
  uploadImages
);

export default router;
