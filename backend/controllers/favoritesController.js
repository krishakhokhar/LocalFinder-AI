import Favorite from "../models/Favorite.js";

export const addFavorite = async (req, res) => {
  try {
    const { placeId, name, category, lat, lng, address, phone, rating, opening_hours } = req.body;

    if (!placeId || !name || typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({
        success: false,
        message: "placeId, name, lat and lng are required",
      });
    }

    const existing = await Favorite.findOne({ userId: req.userId, placeId });
    if (existing) {
      return res.status(400).json({ success: false, message: "Already in favorites" });
    }

    const favorite = await Favorite.create({
      userId: req.userId,
      placeId,
      name,
      category,
      lat,
      lng,
      address,
      phone,
      rating,
      opening_hours,
    });

    return res.status(201).json({ success: true, favorite });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Already in favorites" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Scoped to req.userId only - a user can never see another user's favorites.
export const getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, favorites });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Ownership is enforced in the query itself (userId: req.userId), not just
// checked after the fact - a user can never delete another user's favorite
// even if they guess/know its id.
export const removeFavorite = async (req, res) => {
  try {
    const favorite = await Favorite.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!favorite) {
      return res.status(404).json({ success: false, message: "Favorite not found" });
    }
    return res.status(200).json({ success: true, message: "Removed from favorites" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
