import Notification from "../models/Notification.js";
import { ApiError, ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * GET /api/notifications
 *
 * Scoped to req.user in the query itself - there is no code path here
 * that can read another account's notifications.
 */
export const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, unreadOnly } = req.validatedQuery;

  const filter = { user: req.user._id };
  if (unreadOnly) filter.read = false;

  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);

  return ok(res, {
    notifications,
    unread,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

/**
 * GET /api/notifications/unread-count
 *
 * Deliberately tiny: the navbar badge polls this, so it is a single
 * indexed count and nothing else.
 */
export const unreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  return ok(res, { unread });
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.validatedParams.id, user: req.user._id },
    { read: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw ApiError.notFound("Notification not found");
  return ok(res, { notification });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, read: false },
    { read: true, readAt: new Date() }
  );
  return ok(res, { message: "All caught up", updated: result.modifiedCount });
});

export const removeNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.validatedParams.id,
    user: req.user._id,
  });
  if (!notification) throw ApiError.notFound("Notification not found");
  return ok(res, { message: "Notification removed" });
});
