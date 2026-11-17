import Review from "../models/Review.js";
import Business from "../models/Business.js";
import Booking from "../models/Booking.js";
import Report from "../models/Report.js";
import { ApiError, created, ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { businessIdFromPlaceId } from "../utils/placeId.js";
import { notify } from "../services/notificationService.js";

/** Public shape - never exposes the reviewer's email. */
function toPublicReview(review, currentUserId) {
  const author = review.user && typeof review.user === "object" ? review.user : null;

  return {
    _id: review._id,
    rating: review.rating,
    comment: review.comment || null,
    photos: review.photos || [],
    verifiedBooking: Boolean(review.verifiedBooking),
    createdAt: review.createdAt,
    editedAt: review.editedAt || null,
    author: {
      _id: author?._id || review.user,
      name: author?.name || "LocalFinder user",
      avatarUrl: author?.avatarUrl || null,
    },
    isMine: currentUserId ? String(author?._id || review.user) === String(currentUserId) : false,
  };
}

/**
 * GET /api/reviews/:placeId
 *
 * Works for both kinds of place - a registered business and a plain
 * OpenStreetMap entry - because reviews are keyed by placeId rather than
 * by a foreign key into our own businesses.
 */
export const listReviews = asyncHandler(async (req, res) => {
  const { placeId } = req.validatedParams;
  const { page, limit, sort } = req.validatedQuery;

  const sorts = {
    recent: { createdAt: -1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
  };

  const filter = { placeId, status: "published" };

  const [reviews, total, breakdown] = await Promise.all([
    Review.find(filter)
      .sort(sorts[sort] || sorts.recent)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name avatarUrl")
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([
      { $match: filter },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
  ]);

  // Always five buckets, so a histogram renders consistently.
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const row of breakdown) {
    distribution[row._id] = row.count;
    sum += row._id * row.count;
  }

  const myReview = req.user
    ? await Review.findOne({ placeId, user: req.user._id }).populate("user", "name avatarUrl").lean()
    : null;

  return ok(res, {
    reviews: reviews.map((review) => toPublicReview(review, req.user?._id)),
    myReview: myReview ? toPublicReview(myReview, req.user?._id) : null,
    summary: {
      // Computed from the reviews themselves - there is no other source.
      rating: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
      count: total,
      distribution,
    },
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
});

/** GET /api/reviews/mine - everything the signed-in user has written. */
export const myReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate("user", "name avatarUrl")
    .lean();

  return ok(res, {
    reviews: reviews.map((review) => ({
      ...toPublicReview(review, req.user._id),
      placeId: review.placeId,
      placeName: review.placeName,
      businessId: review.business ? String(review.business) : null,
      status: review.status,
    })),
  });
});

/**
 * POST /api/reviews
 *
 * One review per person per place, enforced by a unique index as well as
 * this check - two simultaneous submissions cannot both get through.
 *
 * `verifiedBooking` is derived from the Booking collection, never
 * accepted from the client: the badge means the server confirmed a
 * completed booking, and it would be worthless if a caller could set it.
 */
export const createReview = asyncHandler(async (req, res) => {
  const { placeId, placeName, rating, comment, photos, lat, lng } = req.body;

  const businessId = businessIdFromPlaceId(placeId);
  let business = null;

  if (businessId) {
    business = await Business.findById(businessId).select("owner name status").lean();
    if (!business) throw ApiError.notFound("That business does not exist");
    if (String(business.owner) === String(req.user._id)) {
      throw ApiError.forbidden("You cannot review your own business");
    }
  }

  const existing = await Review.findOne({ placeId, user: req.user._id }).lean();
  if (existing) {
    throw ApiError.conflict("You have already reviewed this place. Edit your review instead.");
  }

  const completedBooking = businessId
    ? await Booking.findOne({
        business: businessId,
        customer: req.user._id,
        status: "completed",
      })
        .select("_id")
        .lean()
    : null;

  let review;
  try {
    review = await Review.create({
      user: req.user._id,
      placeId,
      business: businessId || null,
      placeName: business?.name || placeName,
      placeSource: businessId ? "localfinder" : "osm",
      lat,
      lng,
      rating,
      comment,
      photos: photos || [],
      booking: completedBooking?._id || null,
      verifiedBooking: Boolean(completedBooking),
    });
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict("You have already reviewed this place.");
    }
    throw error;
  }

  if (business?.owner) {
    await notify.create(business.owner, {
      type: "review_received",
      title: `New ${rating}-star review`,
      body: `${req.user.name} reviewed ${business.name}.`,
      link: `/business/${businessId}`,
      data: { businessId, reviewId: String(review._id) },
    });
  }

  await review.populate("user", "name avatarUrl");
  return created(res, { message: "Thanks for your review", review: toPublicReview(review, req.user._id) });
});

/**
 * PATCH /api/reviews/:id
 *
 * Ownership is part of the query, so another user's review can never be
 * edited even with a guessed id.
 */
export const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ _id: req.validatedParams.id, user: req.user._id });
  if (!review) throw ApiError.notFound("Review not found");
  if (review.status === "removed") {
    throw ApiError.forbidden("This review was removed by a moderator and cannot be edited");
  }

  const { rating, comment, photos } = req.body;
  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  if (photos !== undefined) review.photos = photos;
  review.editedAt = new Date();

  await review.save();
  await review.populate("user", "name avatarUrl");

  return ok(res, { message: "Review updated", review: toPublicReview(review, req.user._id) });
});

/** DELETE /api/reviews/:id */
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ _id: req.validatedParams.id, user: req.user._id });
  if (!review) throw ApiError.notFound("Review not found");

  const businessId = review.business;
  await review.deleteOne();
  // The post-delete hook only fires for document deletes it can see the
  // business on; recompute explicitly so the aggregate is never stale.
  if (businessId) await Review.syncBusinessRating(businessId);

  return ok(res, { message: "Review deleted" });
});

/**
 * POST /api/reviews/:id/report
 *
 * Reporting flags a review for a human to look at. It never hides the
 * review by itself: automatic removal on report count is trivially
 * abusable by anyone with a few accounts.
 */
export const reportReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.validatedParams.id).lean();
  if (!review) throw ApiError.notFound("Review not found");
  if (String(review.user) === String(req.user._id)) {
    throw ApiError.badRequest("You cannot report your own review");
  }

  try {
    await Report.create({
      reporter: req.user._id,
      targetType: "review",
      targetId: review._id,
      targetLabel: `Review of ${review.placeName}`,
      reason: req.body.reason,
      details: req.body.details,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict("You have already reported this review");
    }
    throw error;
  }

  await Review.findByIdAndUpdate(review._id, { $inc: { reportCount: 1 } });

  return created(res, {
    message: "Thanks - a moderator will review this. The review stays visible until then.",
  });
});

/**
 * GET /api/reviews/summary?placeIds=a,b,c
 *
 * Batch rating lookup, so a list of saved places costs one request
 * instead of one per place.
 */
export const reviewSummaries = asyncHandler(async (req, res) => {
  const placeIds = String(req.validatedQuery.placeIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 60);

  const summaries = await Review.summaryForPlaceIds(placeIds);
  return ok(res, { summaries: Object.fromEntries(summaries) });
});

/** Used by the business page to show whether reviewing is possible. */
export const canReview = asyncHandler(async (req, res) => {
  const { placeId } = req.validatedParams;
  const businessId = businessIdFromPlaceId(placeId);

  const existing = await Review.findOne({ placeId, user: req.user._id }).select("_id").lean();
  const business = businessId
    ? await Business.findById(businessId).select("owner").lean()
    : null;

  const isOwner = business && String(business.owner) === String(req.user._id);

  return ok(res, {
    canReview: !existing && !isOwner,
    alreadyReviewed: Boolean(existing),
    isOwner: Boolean(isOwner),
    reviewId: existing?._id || null,
  });
});
