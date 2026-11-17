import User from "../models/User.js";
import Business from "../models/Business.js";
import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import Report from "../models/Report.js";
import Contact from "../models/Contact.js";
import Category from "../models/Category.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js";
import { ApiError, created, ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { notify } from "../services/notificationService.js";
import { dailySeries } from "../services/analyticsService.js";

/* ========================================================================= *
 * Overview
 * ========================================================================= */

/**
 * GET /api/admin/overview
 *
 * Platform totals plus whatever is waiting on a human. Every figure is
 * a count of real documents - there are no derived "estimated" numbers
 * anywhere in this dashboard.
 */
export const overview = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    users,
    newUsers,
    businessesByStatus,
    bookingsByStatus,
    reviews,
    hiddenReviews,
    openReports,
    newContacts,
    signupSeries,
    activitySeries,
    topCategories,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Business.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Review.countDocuments({ status: "published" }),
    Review.countDocuments({ status: { $in: ["hidden", "removed"] } }),
    Report.countDocuments({ status: "open" }),
    Contact.countDocuments({ status: "new" }),
    User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    dailySeries({ types: ["search", "ai_search", "business_view"], days: 30 }),
    Business.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const businessCounts = Object.fromEntries(businessesByStatus.map((row) => [row._id, row.count]));
  const bookingCounts = Object.fromEntries(bookingsByStatus.map((row) => [row._id, row.count]));
  const signupsByDay = new Map(signupSeries.map((row) => [row._id, row.count]));

  return ok(res, {
    totals: {
      users,
      newUsers,
      businesses: Object.values(businessCounts).reduce((sum, count) => sum + count, 0),
      approvedBusinesses: businessCounts.approved || 0,
      pendingBusinesses: businessCounts.pending || 0,
      bookings: Object.values(bookingCounts).reduce((sum, count) => sum + count, 0),
      reviews,
      hiddenReviews,
      openReports,
      newContacts,
    },
    businessesByStatus: businessCounts,
    bookingsByStatus: bookingCounts,
    // Signups and platform activity share a day axis so the two charts
    // line up with each other.
    series: activitySeries.map((row) => ({ ...row, signups: signupsByDay.get(row.day) || 0 })),
    topCategories: topCategories.map((row) => ({ category: row._id, count: row.count })),
  });
});

/* ========================================================================= *
 * Business moderation
 * ========================================================================= */

/** GET /api/admin/businesses */
export const listBusinesses = asyncHandler(async (req, res) => {
  const { status, q, page, limit } = req.validatedQuery;

  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: new RegExp(safe, "i") }, { "address.city": new RegExp(safe, "i") }];
  }

  const [businesses, total] = await Promise.all([
    Business.find(filter)
      // Oldest pending first: a queue should be fair, not newest-first.
      .sort(status === "pending" ? { submittedAt: 1 } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("owner", "name email phone")
      .lean(),
    Business.countDocuments(filter),
  ]);

  return ok(res, {
    businesses: businesses.map((business) => ({
      _id: business._id,
      name: business.name,
      category: business.category,
      status: business.status,
      verified: business.verified,
      description: business.description || null,
      phone: business.phone || null,
      email: business.email || null,
      website: business.website || null,
      logoUrl: business.logoUrl || null,
      gallery: business.gallery || [],
      city: business.address?.city || null,
      addressLine:
        [business.address?.line1, business.address?.area, business.address?.city]
          .filter(Boolean)
          .join(", ") || null,
      lat: business.location?.coordinates?.[1] ?? null,
      lng: business.location?.coordinates?.[0] ?? null,
      servicesCount: (business.services || []).length,
      hoursSet: (business.openingHours || []).length === 7,
      submittedAt: business.submittedAt,
      createdAt: business.createdAt,
      rejectionReason: business.rejectionReason || null,
      owner: business.owner
        ? { _id: business.owner._id, name: business.owner.name, email: business.owner.email, phone: business.owner.phone }
        : null,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

/**
 * POST /api/admin/businesses/:id/decision
 *
 * The only place `verified` is ever set. Approval and the verified badge
 * are the same act: the badge means a human looked at this listing.
 */
export const decideBusiness = asyncHandler(async (req, res) => {
  const { decision, reason } = req.body;

  const business = await Business.findById(req.validatedParams.id);
  if (!business) throw ApiError.notFound("Business not found");

  if (decision === "reject" && !reason) {
    throw ApiError.badRequest("Give a reason - the owner is shown it and needs to know what to fix");
  }

  const outcomes = {
    approve: { status: "approved", verified: true },
    reject: { status: "rejected", verified: false },
    suspend: { status: "suspended", verified: false },
    unsuspend: { status: "approved", verified: true },
  };
  const outcome = outcomes[decision];

  business.status = outcome.status;
  business.verified = outcome.verified;
  business.rejectionReason = decision === "approve" || decision === "unsuspend" ? undefined : reason;
  business.reviewedAt = new Date();
  business.reviewedBy = req.user._id;
  await business.save();

  const messages = {
    approve: {
      type: "business_approved",
      title: "Your listing is live",
      body: `${business.name} has been approved and is now visible in search.`,
    },
    reject: {
      type: "business_rejected",
      title: "Listing needs changes",
      body: `${business.name} was not approved: ${reason}`,
    },
    suspend: {
      type: "business_suspended",
      title: "Listing suspended",
      body: `${business.name} has been suspended: ${reason}`,
    },
    unsuspend: {
      type: "business_approved",
      title: "Listing restored",
      body: `${business.name} is visible in search again.`,
    },
  };

  await notify.create(business.owner, {
    ...messages[decision],
    link: `/owner/businesses/${business._id}`,
    data: { businessId: String(business._id) },
  });

  return ok(res, {
    message: `Listing ${outcome.status}`,
    business: { _id: business._id, status: business.status, verified: business.verified },
  });
});

/* ========================================================================= *
 * Users
 * ========================================================================= */

export const listUsers = asyncHandler(async (req, res) => {
  const { role, q, page, limit } = req.validatedQuery;

  const filter = {};
  if (role) filter.role = role;
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  // One aggregation for the whole page rather than a query per row.
  const ids = users.map((user) => user._id);
  const [businessCounts, reviewCounts] = await Promise.all([
    Business.aggregate([{ $match: { owner: { $in: ids } } }, { $group: { _id: "$owner", count: { $sum: 1 } } }]),
    Review.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]),
  ]);
  const businessesByOwner = new Map(businessCounts.map((row) => [String(row._id), row.count]));
  const reviewsByUser = new Map(reviewCounts.map((row) => [String(row._id), row.count]));

  return ok(res, {
    users: users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || null,
      city: user.city || null,
      isActive: user.isActive,
      suspendedReason: user.suspendedReason || null,
      lastLoginAt: user.lastLoginAt || null,
      createdAt: user.createdAt,
      businessCount: businessesByOwner.get(String(user._id)) || 0,
      reviewCount: reviewsByUser.get(String(user._id)) || 0,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

/**
 * PATCH /api/admin/users/:id
 *
 * Role changes and suspension. An admin cannot act on their own account
 * here - demoting or deactivating yourself is almost always a mistake,
 * and in the worst case locks the last admin out of the platform.
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { role, isActive, reason } = req.body;

  if (String(req.validatedParams.id) === String(req.user._id)) {
    throw ApiError.badRequest("Use your own account settings to change your own account");
  }

  const user = await User.findById(req.validatedParams.id);
  if (!user) throw ApiError.notFound("User not found");

  if (role !== undefined && role !== user.role) {
    // Never let the last active admin be demoted.
    if (user.role === "admin") {
      const admins = await User.countDocuments({ role: "admin", isActive: true });
      if (admins <= 1) throw ApiError.badRequest("This is the only active admin account");
    }
    user.role = role;
  }

  if (isActive !== undefined && isActive !== user.isActive) {
    if (user.role === "admin" && !isActive) {
      const admins = await User.countDocuments({ role: "admin", isActive: true });
      if (admins <= 1) throw ApiError.badRequest("This is the only active admin account");
    }
    user.isActive = isActive;
    user.suspendedReason = isActive ? undefined : reason;

    await notify.create(user._id, {
      type: "account",
      title: isActive ? "Account restored" : "Account deactivated",
      body: isActive
        ? "Your account has been restored. You can sign in as usual."
        : `Your account has been deactivated${reason ? `: ${reason}` : "."}`,
      link: "/contact",
    });
  }

  await user.save();
  return ok(res, { message: "User updated", user: user.toPublic() });
});

/* ========================================================================= *
 * Review moderation
 * ========================================================================= */

export const listReviews = asyncHandler(async (req, res) => {
  const { status, reported, page, limit } = req.validatedQuery;

  const filter = {};
  if (status) filter.status = status;
  if (reported) filter.reportCount = { $gt: 0 };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort(reported ? { reportCount: -1, createdAt: -1 } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name email")
      .lean(),
    Review.countDocuments(filter),
  ]);

  return ok(res, {
    reviews: reviews.map((review) => ({
      _id: review._id,
      rating: review.rating,
      comment: review.comment || null,
      photos: review.photos || [],
      status: review.status,
      reportCount: review.reportCount || 0,
      verifiedBooking: review.verifiedBooking,
      placeName: review.placeName,
      placeId: review.placeId,
      businessId: review.business ? String(review.business) : null,
      createdAt: review.createdAt,
      moderationNote: review.moderationNote || null,
      author: review.user ? { _id: review.user._id, name: review.user.name, email: review.user.email } : null,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

/**
 * PATCH /api/admin/reviews/:id
 *
 * Hiding or restoring a review recomputes the business's rating, so a
 * moderated review stops counting towards the average immediately.
 */
export const moderateReview = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const review = await Review.findById(req.validatedParams.id);
  if (!review) throw ApiError.notFound("Review not found");

  const previous = review.status;
  review.status = status;
  review.moderationNote = note;
  await review.save();

  if (review.business) await Review.syncBusinessRating(review.business);

  if (status === "removed" && previous !== "removed") {
    await notify.create(review.user, {
      type: "review_removed",
      title: "Your review was removed",
      body: `Your review of ${review.placeName} was removed by a moderator${note ? `: ${note}` : "."}`,
      link: "/contact",
    });
  }

  return ok(res, { message: `Review ${status}`, review: { _id: review._id, status: review.status } });
});

/* ========================================================================= *
 * Reports
 * ========================================================================= */

export const listReports = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;

  const filter = {};
  if (status) filter.status = status;

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("reporter", "name email")
      .lean(),
    Report.countDocuments(filter),
  ]);

  return ok(res, {
    reports,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const resolveReport = asyncHandler(async (req, res) => {
  const { status, resolution } = req.body;

  const report = await Report.findById(req.validatedParams.id);
  if (!report) throw ApiError.notFound("Report not found");

  report.status = status;
  report.resolution = resolution;
  report.handledBy = req.user._id;
  report.handledAt = new Date();
  await report.save();

  await notify.create(report.reporter, {
    type: "report_resolved",
    title: status === "resolved" ? "Thanks - we acted on your report" : "Report reviewed",
    body:
      status === "resolved"
        ? `We looked at your report about ${report.targetLabel || "that item"} and took action.`
        : `We reviewed your report about ${report.targetLabel || "that item"} and took no action.`,
  });

  return ok(res, { message: "Report updated", report });
});

/* ========================================================================= *
 * Contacts
 * ========================================================================= */

export const listContacts = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;

  const filter = {};
  if (status) filter.status = status;

  const [contacts, total] = await Promise.all([
    Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Contact.countDocuments(filter),
  ]);

  return ok(res, { contacts, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const updateContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(
    req.validatedParams.id,
    {
      status: req.body.status,
      internalNote: req.body.internalNote,
      handledBy: req.user._id,
      handledAt: new Date(),
    },
    { new: true }
  );
  if (!contact) throw ApiError.notFound("Message not found");
  return ok(res, { message: "Message updated", contact });
});

/* ========================================================================= *
 * Categories
 * ========================================================================= */

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ order: 1, label: 1 }).lean();

  // How many approved businesses sit in each category, so an admin can
  // see what is actually used before deactivating one.
  const counts = await Business.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const byKey = new Map(counts.map((row) => [row._id, row.count]));

  return ok(res, {
    categories: categories.map((category) => ({
      ...category,
      businessCount: byKey.get(category.key) || 0,
    })),
  });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  return created(res, { message: "Category created", category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.validatedParams.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) throw ApiError.notFound("Category not found");
  return ok(res, { message: "Category updated", category });
});

/**
 * DELETE /api/admin/categories/:id
 *
 * Refused while businesses still use it: deleting would leave those
 * listings in a category that no longer exists and quietly drop them out
 * of every filtered search.
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.validatedParams.id);
  if (!category) throw ApiError.notFound("Category not found");

  const inUse = await Business.countDocuments({ category: category.key });
  if (inUse > 0) {
    throw ApiError.conflict(
      `${inUse} business(es) use this category. Deactivate it instead of deleting it.`
    );
  }

  await category.deleteOne();
  return ok(res, { message: "Category deleted" });
});

/* ========================================================================= *
 * Platform analytics
 * ========================================================================= */

export const analytics = asyncHandler(async (req, res) => {
  const days = req.validatedQuery.days || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [series, topBusinesses, searchTerms, bookingTrend] = await Promise.all([
    dailySeries({ types: ["search", "ai_search", "business_view"], days }),
    Business.find({ status: "approved" }).sort({ viewCount: -1 }).limit(8).select("name viewCount ratingAvg ratingCount").lean(),
    AnalyticsEvent.aggregate([
      { $match: { type: { $in: ["search", "ai_search"] }, createdAt: { $gte: since } } },
      { $group: { _id: "$meta.category", count: { $sum: 1 } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const bookingsByDay = new Map(bookingTrend.map((row) => [row._id, row.count]));

  return ok(res, {
    days,
    series: series.map((row) => ({ ...row, bookings: bookingsByDay.get(row.day) || 0 })),
    topBusinesses: topBusinesses.map((business) => ({
      _id: business._id,
      name: business.name,
      views: business.viewCount || 0,
      rating: business.ratingCount > 0 ? business.ratingAvg : null,
      ratingCount: business.ratingCount || 0,
    })),
    topSearchCategories: searchTerms.map((row) => ({ category: row._id, count: row.count })),
  });
});
