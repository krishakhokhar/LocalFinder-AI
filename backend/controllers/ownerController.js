import Business from "../models/Business.js";
import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { businessPlaceId } from "../utils/placeId.js";
import { dailySeries, totalsByType } from "../services/analyticsService.js";

/** Asserts the caller owns (or administers) the business. */
async function assertOwnership(businessId, user) {
  const business = await Business.findById(businessId).lean();
  if (!business) throw ApiError.notFound("Business not found");
  if (String(business.owner) !== String(user._id) && user.role !== "admin") {
    throw ApiError.forbidden("You can only view businesses you own");
  }
  return business;
}

/**
 * GET /api/owner/overview
 *
 * Everything the dashboard's top section needs, in one request: the
 * owner's listings, their combined counters, and whatever needs their
 * attention right now.
 *
 * Every number here is counted from real records. A brand-new listing
 * shows zeros, and the UI says what to do about that - it never gets a
 * flattering placeholder.
 */
export const overview = asyncHandler(async (req, res) => {
  const businesses = await Business.find({ owner: req.user._id }).lean();
  const ids = businesses.map((business) => business._id);

  if (ids.length === 0) {
    return ok(res, {
      businesses: [],
      totals: { views: 0, inquiries: 0, bookings: 0, upcoming: 0, reviews: 0, rating: null, pending: 0 },
      upcoming: [],
      recentReviews: [],
      needsAttention: [],
    });
  }

  const now = new Date();
  const placeIds = ids.map((id) => businessPlaceId(id));

  const [bookingCounts, upcomingBookings, reviewSummaries, recentReviews] = await Promise.all([
    Booking.aggregate([
      { $match: { business: { $in: ids } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Booking.find({
      business: { $in: ids },
      status: { $in: ["pending", "confirmed"] },
      startAt: { $gte: now },
    })
      .sort({ startAt: 1 })
      .limit(8)
      .populate("customer", "name phone")
      .populate("business", "name")
      .lean(),
    Review.summaryForPlaceIds(placeIds),
    Review.find({ business: { $in: ids }, status: "published" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "name avatarUrl")
      .lean(),
  ]);

  const statusCounts = Object.fromEntries(bookingCounts.map((row) => [row._id, row.count]));

  // Weighted across every listing, so an owner with two businesses sees
  // one honest average rather than the mean of two averages.
  let ratingSum = 0;
  let ratingCount = 0;
  for (const placeId of placeIds) {
    const summary = reviewSummaries.get(placeId);
    if (summary) {
      ratingSum += summary.rating * summary.ratingCount;
      ratingCount += summary.ratingCount;
    }
  }

  const needsAttention = [];
  for (const business of businesses) {
    if (business.status === "draft") {
      needsAttention.push({
        businessId: String(business._id),
        name: business.name,
        kind: "draft",
        message: "This listing is a draft. Submit it for review to go live.",
      });
    }
    if (business.status === "rejected") {
      needsAttention.push({
        businessId: String(business._id),
        name: business.name,
        kind: "rejected",
        message: business.rejectionReason || "This listing was rejected. Update it and resubmit.",
      });
    }
    if (business.status === "approved" && (business.services || []).length === 0) {
      needsAttention.push({
        businessId: String(business._id),
        name: business.name,
        kind: "no-services",
        message: "Add your services so customers know what you offer and what it costs.",
      });
    }
    if (business.status === "approved" && (business.openingHours || []).length !== 7) {
      needsAttention.push({
        businessId: String(business._id),
        name: business.name,
        kind: "no-hours",
        message: "Set your opening hours so customers see when you are open.",
      });
    }
  }

  const pendingBookings = statusCounts.pending || 0;
  if (pendingBookings > 0) {
    needsAttention.unshift({
      kind: "pending-bookings",
      message: `${pendingBookings} booking request${pendingBookings === 1 ? "" : "s"} waiting for your response.`,
    });
  }

  return ok(res, {
    businesses: businesses.map((business) => {
      const summary = reviewSummaries.get(businessPlaceId(business._id));
      return {
        _id: business._id,
        name: business.name,
        category: business.category,
        status: business.status,
        verified: business.verified,
        logoUrl: business.logoUrl || null,
        city: business.address?.city || null,
        viewCount: business.viewCount || 0,
        inquiryCount: business.inquiryCount || 0,
        acceptsBookings: business.acceptsBookings,
        servicesCount: (business.services || []).length,
        rating: summary?.rating ?? null,
        ratingCount: summary?.ratingCount ?? 0,
        rejectionReason: business.rejectionReason || null,
      };
    }),
    totals: {
      views: businesses.reduce((sum, business) => sum + (business.viewCount || 0), 0),
      inquiries: businesses.reduce((sum, business) => sum + (business.inquiryCount || 0), 0),
      bookings: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      upcoming: upcomingBookings.length,
      pending: pendingBookings,
      reviews: ratingCount,
      rating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    },
    bookingsByStatus: statusCounts,
    upcoming: upcomingBookings.map((booking) => ({
      _id: booking._id,
      businessName: booking.business?.name,
      customerName: booking.customer?.name || "Customer",
      customerPhone: booking.customer?.phone || booking.contact?.phone || null,
      serviceName: booking.service?.name,
      startAt: booking.startAt,
      endAt: booking.endAt,
      status: booking.status,
    })),
    recentReviews: recentReviews.map((review) => ({
      _id: review._id,
      rating: review.rating,
      comment: review.comment || null,
      createdAt: review.createdAt,
      placeName: review.placeName,
      businessId: review.business ? String(review.business) : null,
      author: { name: review.user?.name || "LocalFinder user", avatarUrl: review.user?.avatarUrl || null },
    })),
    needsAttention,
  });
});

/**
 * GET /api/owner/businesses/:id/analytics
 *
 * Daily series plus totals for one listing. Returns zero-filled days so a
 * chart never draws a straight line across days that simply had no
 * events.
 */
export const businessAnalytics = asyncHandler(async (req, res) => {
  const business = await assertOwnership(req.validatedParams.id, req.user);
  const days = req.validatedQuery.days || 30;

  const [series, totals, bookingSeries, popularServices] = await Promise.all([
    dailySeries({
      businessId: business._id,
      types: ["business_view", "business_call", "business_directions", "business_inquiry"],
      days,
    }),
    totalsByType({ businessId: business._id, days }),
    Booking.aggregate([
      {
        $match: {
          business: business._id,
          createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        },
      },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { business: business._id, status: { $in: ["confirmed", "completed"] } } },
      { $group: { _id: "$service.name", count: { $sum: 1 }, revenue: { $sum: "$service.price" } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const bookingsByDay = new Map(bookingSeries.map((row) => [row._id, row.count]));

  return ok(res, {
    days,
    series: series.map((row) => ({ ...row, bookings: bookingsByDay.get(row.day) || 0 })),
    totals: {
      views: totals.business_view || 0,
      calls: totals.business_call || 0,
      directions: totals.business_directions || 0,
      inquiries: totals.business_inquiry || 0,
    },
    popularServices: popularServices.map((row) => ({
      name: row._id,
      bookings: row.count,
      // Null rather than 0 when no booked service carried a price.
      revenue: row.revenue || null,
    })),
    profileCompletion: new Business(business).profileCompletion,
  });
});

/** GET /api/owner/businesses/:id/reviews */
export const businessReviews = asyncHandler(async (req, res) => {
  const business = await assertOwnership(req.validatedParams.id, req.user);

  const reviews = await Review.find({ business: business._id, status: "published" })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("user", "name avatarUrl")
    .lean();

  return ok(res, {
    reviews: reviews.map((review) => ({
      _id: review._id,
      rating: review.rating,
      comment: review.comment || null,
      photos: review.photos || [],
      verifiedBooking: review.verifiedBooking,
      createdAt: review.createdAt,
      author: { name: review.user?.name || "LocalFinder user", avatarUrl: review.user?.avatarUrl || null },
    })),
  });
});
