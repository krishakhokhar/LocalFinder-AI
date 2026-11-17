import express from "express";
import {
  listReviews,
  myReviews,
  createReview,
  updateReview,
  deleteReview,
  reportReview,
  reviewSummaries,
  canReview,
} from "../controllers/reviewController.js";
import { protect, optionalAuth } from "../middleware/authMiddleware.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import {
  createReviewSchema,
  updateReviewSchema,
  reportReviewSchema,
  reviewIdParamSchema,
  placeIdParamSchema,
  listReviewsSchema,
  summaryQuerySchema,
} from "../validators/reviewSchemas.js";

const router = express.Router();

// Literal paths first, so "/mine" and "/summary" are not read as a placeId.
router.get("/mine", protect, myReviews);
router.get("/summary", validateQuery(summaryQuerySchema), reviewSummaries);

router.post("/", protect, writeLimiter, validateBody(createReviewSchema), createReview);

router.get(
  "/place/:placeId/can-review",
  protect,
  validateParams(placeIdParamSchema),
  canReview
);
router.get(
  "/place/:placeId",
  optionalAuth,
  validateParams(placeIdParamSchema),
  validateQuery(listReviewsSchema),
  listReviews
);

router.patch("/:id", protect, writeLimiter, validateParams(reviewIdParamSchema), validateBody(updateReviewSchema), updateReview);
router.delete("/:id", protect, validateParams(reviewIdParamSchema), deleteReview);
router.post(
  "/:id/report",
  protect,
  writeLimiter,
  validateParams(reviewIdParamSchema),
  validateBody(reportReviewSchema),
  reportReview
);

export default router;
