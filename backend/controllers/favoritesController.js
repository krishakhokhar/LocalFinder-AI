import Favorite from "../models/Favorite.js";
import Review from "../models/Review.js";
import { ApiError, ok, created } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { businessIdFromPlaceId, isBusinessPlaceId } from "../utils/placeId.js";

/**
 * Favourites are stored with just enough of a snapshot to render a card
 * offline (name, coordinates, address, phone). Ratings are *not* snapshotted:
 * they are looked up live from the Review collection on read, so a saved
 * place always shows the current real rating rather than a stale - or, in
 * the previous version, randomly generated - one.
 */
function present(favorite, summaries) {
  const summary = summaries.get(favorite.placeId);
  return {
    _id: favorite._id,
    placeId: favorite.placeId,
    name: favorite.name,
    category: favorite.category || null,
    lat: favorite.lat,
    lng: favorite.lng,
    address: favorite.address || null,
    phone: favorite.phone || null,
    openingHoursRaw: favorite.opening_hours || null,
    source: favorite.source || (isBusinessPlaceId(favorite.placeId) ? "localfinder" : "osm"),
    businessId: favorite.business ? String(favorite.business) : businessIdFromPlaceId(favorite.placeId),
    rating: summary?.rating ?? null,
    ratingCount: summary?.ratingCount ?? 0,
    createdAt: favorite.createdAt,
  };
}

export const addFavorite = asyncHandler(async (req, res) => {
  const { placeId, name, category, lat, lng, address, phone, opening_hours: openingHours } = req.body;

  const existing = await Favorite.findOne({ userId: req.userId, placeId }).lean();
  if (existing) {
    throw ApiError.conflict("Already in favorites");
  }

  const businessId = businessIdFromPlaceId(placeId);
  const favorite = await Favorite.create({
    userId: req.userId,
    placeId,
    name,
    category,
    lat,
    lng,
    address,
    phone,
    opening_hours: openingHours,
    business: businessId || null,
    source: businessId ? "localfinder" : "osm",
  });

  const summaries = await Review.summaryForPlaceIds([placeId]);
  return created(res, { favorite: present(favorite, summaries) });
});

/** Scoped to req.userId only - a user can never see another user's favorites. */
export const getFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
  const summaries = await Review.summaryForPlaceIds(favorites.map((favorite) => favorite.placeId));

  return ok(res, { favorites: favorites.map((favorite) => present(favorite, summaries)) });
});

/**
 * Ownership is enforced in the query itself (userId: req.userId), not just
 * checked after the fact - a user can never delete another user's favorite
 * even if they guess/know its id.
 */
export const removeFavorite = asyncHandler(async (req, res) => {
  const favorite = await Favorite.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!favorite) {
    throw ApiError.notFound("Favorite not found");
  }
  return ok(res, { message: "Removed from favorites" });
});

/** Deleting by placeId, so the UI can un-favourite from a search result. */
export const removeFavoriteByPlaceId = asyncHandler(async (req, res) => {
  const favorite = await Favorite.findOneAndDelete({
    placeId: req.body.placeId,
    userId: req.userId,
  });
  if (!favorite) {
    throw ApiError.notFound("Favorite not found");
  }
  return ok(res, { message: "Removed from favorites" });
});
