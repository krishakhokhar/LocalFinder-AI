import express from "express";
import {
  addFavorite,
  getFavorites,
  removeFavorite,
  removeFavoriteByPlaceId,
} from "../controllers/favoritesController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { addFavoriteSchema, removeByPlaceIdSchema } from "../validators/favoriteSchemas.js";

const router = express.Router();

router.use(protect);

router.get("/", getFavorites);
router.post("/", writeLimiter, validateBody(addFavoriteSchema), addFavorite);
router.post("/remove", writeLimiter, validateBody(removeByPlaceIdSchema), removeFavoriteByPlaceId);
router.delete("/:id", removeFavorite);

export default router;
