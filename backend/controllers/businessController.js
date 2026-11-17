import mongoose from "mongoose";
import Business from "../models/Business.js";
import Review from "../models/Review.js";
import { ApiError, created, ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { businessPlaceId } from "../utils/placeId.js";
import { toGeoPoint } from "../utils/geo.js";
import { recordBusinessView, recordEvent } from "../services/analyticsService.js";
import { notify } from "../services/notificationService.js";
import User from "../models/User.js";

/**
 * Public shape of a business.
 *
 * Deliberately omits the owner's email and any internal moderation fields.
 * The rating is read from the Review collection rather than trusted from
 * the denormalised counter, so what a visitor sees is always the live
 * aggregate of real reviews.
 */
function toPublicBusiness(business, { rating = null, ratingCount = 0, isOwner = false } = {}) {
  const [lng, lat] = business.location?.coordinates || [];

  const base = {
    _id: business._id,
    placeId: businessPlaceId(business._id),
    source: "localfinder",
    businessId: String(business._id),
    name: business.name,
    category: business.category,
    description: business.description || null,
    phone: business.phone || null,
    email: business.email || null,
    website: business.website || null,
    address: business.address || null,
    addressLine:
      [business.address?.line1, business.address?.area, business.address?.city]
        .filter(Boolean)
        .join(", ") || null,
    lat,
    lng,
    logoUrl: business.logoUrl || null,
    gallery: business.gallery || [],
    images: business.gallery || [],
    openingHours: business.openingHours || [],
    services: (business.services || [])
      .filter((service) => isOwner || service.active)
      .map((service) => ({
        _id: service._id,
        name: service.name,
        description: service.description || null,
        durationMinutes: service.durationMinutes,
        price: typeof service.price === "number" ? service.price : null,
        currency: service.currency || "INR",
        active: service.active,
      })),
    amenities: business.amenities || [],
    priceRange: business.priceRange ?? null,
    verified: Boolean(business.verified),
    acceptsBookings:
      Boolean(business.acceptsBookings) && (business.services || []).some((service) => service.active),
    bookingSettings: business.bookingSettings,
    rating,
    ratingCount,
    viewCount: business.viewCount || 0,
    createdAt: business.createdAt,
  };

  if (isOwner) {
    return {
      ...base,
      status: business.status,
      rejectionReason: business.rejectionReason || null,
      submittedAt: business.submittedAt || null,
      reviewedAt: business.reviewedAt || null,
      inquiryCount: business.inquiryCount || 0,
      profileCompletion: business.profileCompletion,
      owner: business.owner,
    };
  }

  return base;
}

/** Loads a business and asserts the caller may administer it. */
async function loadOwned(id, user) {
  const business = await Business.findById(id);
  if (!business) throw ApiError.notFound("Business not found");

  const isOwner = String(business.owner) === String(user._id);
  if (!isOwner && user.role !== "admin") {
    throw ApiError.forbidden("You can only manage businesses you own");
  }
  return business;
}

function applyWritableFields(business, payload) {
  const writable = [
    "name",
    "category",
    "description",
    "phone",
    "email",
    "website",
    "logoUrl",
    "gallery",
    "amenities",
    "priceRange",
    "acceptsBookings",
  ];

  for (const field of writable) {
    if (payload[field] !== undefined) business[field] = payload[field];
  }

  if (payload.address) {
    business.address = { ...(business.address?.toObject?.() || business.address || {}), ...payload.address };
  }
  if (payload.lat !== undefined && payload.lng !== undefined) {
    business.location = toGeoPoint(payload.lat, payload.lng);
  }
  if (payload.openingHours) business.openingHours = payload.openingHours;
  if (payload.services) business.services = payload.services;
}

/* ========================================================================= *
 * Public
 * ========================================================================= */

/** GET /api/businesses - directory of approved listings. */
export const listBusinesses = asyncHandler(async (req, res) => {
  const { q, category, city, page, limit, sort } = req.validatedQuery;

  const filter = { status: "approved" };
  if (category && category !== "all") filter.category = category;
  if (city) filter["address.city"] = new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (q) filter.$text = { $search: q };

  const sorts = {
    recent: { createdAt: -1 },
    rating: { ratingAvg: -1, ratingCount: -1 },
    name: { name: 1 },
    views: { viewCount: -1 },
  };

  const [items, total] = await Promise.all([
    Business.find(filter)
      .sort(sorts[sort] || sorts.recent)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Business.countDocuments(filter),
  ]);

  const summaries = await Review.summaryForPlaceIds(items.map((item) => businessPlaceId(item._id)));

  return ok(res, {
    businesses: items.map((item) => {
      const summary = summaries.get(businessPlaceId(item._id));
      return toPublicBusiness(item, { rating: summary?.rating ?? null, ratingCount: summary?.ratingCount ?? 0 });
    }),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

/**
 * GET /api/businesses/:id
 *
 * Approved listings are public. A listing that is still a draft, pending
 * or rejected is visible only to its owner and to admins, so an owner can
 * preview exactly what they are about to submit.
 */
export const getBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.validatedParams.id);
  if (!business) throw ApiError.notFound("Business not found");

  const isOwner = req.user && String(business.owner) === String(req.user._id);
  const isAdmin = req.user?.role === "admin";

  if (business.status !== "approved" && !isOwner && !isAdmin) {
    throw ApiError.notFound("Business not found");
  }

  const placeId = businessPlaceId(business._id);
  const summaries = await Review.summaryForPlaceIds([placeId]);
  const summary = summaries.get(placeId);

  // Owners looking at their own page should not inflate their view count.
  if (business.status === "approved" && !isOwner) {
    recordBusinessView({ businessId: business._id, user: req.user?._id || null, placeId });
  }

  return ok(res, {
    business: toPublicBusiness(business, {
      rating: summary?.rating ?? null,
      ratingCount: summary?.ratingCount ?? 0,
      isOwner: Boolean(isOwner || isAdmin),
    }),
  });
});

/** POST /api/businesses/:id/contact-event - records a call/directions tap. */
export const recordInteraction = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams;
  const type = req.body.type;
  const allowed = { call: "business_call", directions: "business_directions", inquiry: "business_inquiry" };
  if (!allowed[type]) throw ApiError.badRequest("Unknown interaction type");

  recordEvent({ type: allowed[type], business: id, user: req.user?._id || null });
  if (type === "inquiry") {
    await Business.findByIdAndUpdate(id, { $inc: { inquiryCount: 1 } });
  }

  return ok(res, { recorded: true });
});

/* ========================================================================= *
 * Owner
 * ========================================================================= */

/** GET /api/businesses/mine */
export const myBusinesses = asyncHandler(async (req, res) => {
  const businesses = await Business.find({ owner: req.user._id }).sort({ createdAt: -1 });
  const summaries = await Review.summaryForPlaceIds(
    businesses.map((business) => businessPlaceId(business._id))
  );

  return ok(res, {
    businesses: businesses.map((business) => {
      const summary = summaries.get(businessPlaceId(business._id));
      return toPublicBusiness(business, {
        rating: summary?.rating ?? null,
        ratingCount: summary?.ratingCount ?? 0,
        isOwner: true,
      });
    }),
  });
});

/**
 * POST /api/businesses
 *
 * A new listing is always created as a draft. It becomes publicly visible
 * only after the owner submits it and an admin approves it - there is no
 * path through this API that publishes a listing directly.
 */
export const createBusiness = asyncHandler(async (req, res) => {
  const payload = req.body;

  const existing = await Business.countDocuments({ owner: req.user._id });
  if (existing >= 10) {
    throw ApiError.badRequest("You have reached the limit of 10 businesses per account");
  }

  const business = new Business({
    owner: req.user._id,
    status: "draft",
    verified: false,
    location: toGeoPoint(payload.lat, payload.lng),
  });
  applyWritableFields(business, payload);
  await business.save();

  return created(res, {
    message: "Business created as a draft. Submit it for review when you are ready.",
    business: toPublicBusiness(business, { isOwner: true }),
  });
});

/**
 * PATCH /api/businesses/:id
 *
 * Editing an approved listing sends it back to pending: the published
 * details must always be ones an admin has actually seen. `verified` and
 * `status` are never writable from here.
 */
export const updateBusiness = asyncHandler(async (req, res) => {
  const business = await loadOwned(req.validatedParams.id, req.user);
  const wasApproved = business.status === "approved";

  applyWritableFields(business, req.body);

  const significantFields = ["name", "category", "address", "lat", "lng", "description"];
  const changedSignificantly = significantFields.some((field) => req.body[field] !== undefined);

  if (wasApproved && changedSignificantly && req.user.role !== "admin") {
    business.status = "pending";
    business.verified = false;
    business.submittedAt = new Date();
  }

  await business.save();

  return ok(res, {
    message:
      wasApproved && changedSignificantly && req.user.role !== "admin"
        ? "Saved. Because key details changed, the listing is back in review."
        : "Changes saved",
    business: toPublicBusiness(business, { isOwner: true }),
  });
});

/** POST /api/businesses/:id/submit */
export const submitBusiness = asyncHandler(async (req, res) => {
  const business = await loadOwned(req.validatedParams.id, req.user);

  if (business.status === "pending") throw ApiError.badRequest("This listing is already in review");
  if (business.status === "suspended") {
    throw ApiError.forbidden("This listing is suspended. Contact support.");
  }

  // Minimum bar for a listing a reviewer can meaningfully assess.
  const missing = [];
  if (!business.name) missing.push("name");
  if (!business.category) missing.push("category");
  if (!business.address?.city) missing.push("city");
  if (!business.location?.coordinates?.length) missing.push("map location");
  if (!business.phone && !business.email) missing.push("a phone number or email");
  if (missing.length > 0) {
    throw ApiError.badRequest(`Add the following before submitting: ${missing.join(", ")}`);
  }

  business.status = "pending";
  business.submittedAt = new Date();
  business.rejectionReason = undefined;
  await business.save();

  // Tell the admins there is something in the queue.
  const admins = await User.find({ role: "admin", isActive: true }).select("_id").lean();
  await notify.many(
    admins.map((admin) => admin._id),
    {
      type: "business_submitted",
      title: "New listing awaiting review",
      body: `${business.name} was submitted for approval.`,
      link: "/admin/businesses",
      data: { businessId: String(business._id) },
    }
  );

  return ok(res, {
    message: "Submitted for review. We will let you know once it is approved.",
    business: toPublicBusiness(business, { isOwner: true }),
  });
});

/** PATCH /api/businesses/:id/booking-settings */
export const updateBookingSettings = asyncHandler(async (req, res) => {
  const business = await loadOwned(req.validatedParams.id, req.user);
  const { acceptsBookings, ...settings } = req.body;

  if (acceptsBookings !== undefined) business.acceptsBookings = acceptsBookings;
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) business.bookingSettings[key] = value;
  }

  if (business.acceptsBookings && !(business.services || []).some((service) => service.active)) {
    throw ApiError.badRequest("Add at least one active service before accepting bookings");
  }
  if (business.acceptsBookings && (business.openingHours || []).length !== 7) {
    throw ApiError.badRequest("Set your opening hours before accepting bookings");
  }

  await business.save();
  return ok(res, { message: "Booking settings saved", business: toPublicBusiness(business, { isOwner: true }) });
});

/** PUT /api/businesses/:id/hours */
export const setOpeningHours = asyncHandler(async (req, res) => {
  const business = await loadOwned(req.validatedParams.id, req.user);
  business.openingHours = req.body.openingHours;
  await business.save();
  return ok(res, { message: "Opening hours saved", openingHours: business.openingHours });
});

/** POST /api/businesses/:id/services */
export const addService = asyncHandler(async (req, res) => {
  const business = await loadOwned(req.validatedParams.id, req.user);
  if (business.services.length >= 30) {
    throw ApiError.badRequest("A business can list at most 30 services");
  }
  business.services.push(req.body);
  await business.save();

  return created(res, {
    message: "Service added",
    service: business.services[business.services.length - 1],
  });
});

/** PATCH /api/businesses/:id/services/:serviceId */
export const updateService = asyncHandler(async (req, res) => {
  const business = await loadOwned(req.validatedParams.id, req.user);
  const service = business.services.id(req.validatedParams.serviceId);
  if (!service) throw ApiError.notFound("Service not found");

  for (const [key, value] of Object.entries(req.body)) {
    if (value !== undefined) service[key] = value;
  }
  await business.save();

  return ok(res, { message: "Service updated", service });
});

/**
 * DELETE /api/businesses/:id/services/:serviceId
 *
 * Deactivates rather than deletes when the service has bookings attached,
 * so booking history keeps pointing at something real.
 */
export const removeService = asyncHandler(async (req, res) => {
  const business = await loadOwned(req.validatedParams.id, req.user);
  const service = business.services.id(req.validatedParams.serviceId);
  if (!service) throw ApiError.notFound("Service not found");

  const Booking = mongoose.model("Booking");
  const bookingCount = await Booking.countDocuments({
    business: business._id,
    "service.serviceId": service._id,
  });

  if (bookingCount > 0) {
    service.active = false;
    await business.save();
    return ok(res, {
      message: "This service has bookings, so it was hidden from customers rather than deleted.",
      deactivated: true,
    });
  }

  service.deleteOne();
  await business.save();
  return ok(res, { message: "Service removed", deactivated: false });
});

/**
 * DELETE /api/businesses/:id
 *
 * Refused while bookings are still upcoming - cancelling on a customer
 * silently is not something a delete button should do.
 */
export const deleteBusiness = asyncHandler(async (req, res) => {
  const business = await loadOwned(req.validatedParams.id, req.user);

  const Booking = mongoose.model("Booking");
  const upcoming = await Booking.countDocuments({
    business: business._id,
    status: { $in: ["pending", "confirmed"] },
    startAt: { $gte: new Date() },
  });

  if (upcoming > 0) {
    throw ApiError.conflict(
      `This listing has ${upcoming} upcoming booking(s). Cancel or complete them first.`
    );
  }

  await business.deleteOne();
  return ok(res, { message: "Listing deleted" });
});
