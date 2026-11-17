import Notification from "../models/Notification.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("notify");

/**
 * In-app notifications.
 *
 * Creating a notification must never be able to fail the action that
 * caused it: if the booking was accepted, the booking is accepted, even
 * if we could not write the "your booking was accepted" row. Failures are
 * logged and swallowed for that reason.
 *
 * Email/SMS would slot in here as additional channels behind the same
 * calls; nothing else in the codebase would need to change.
 */
async function create(userId, { type, title, body, link, data }) {
  if (!userId) return null;
  try {
    return await Notification.create({ user: userId, type, title, body, link, data });
  } catch (error) {
    log.warn(`could not create ${type} notification: ${error.message}`);
    return null;
  }
}

async function many(userIds, payload) {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return [];
  try {
    return await Notification.insertMany(
      ids.map((userId) => ({ user: userId, ...payload })),
      { ordered: false }
    );
  } catch (error) {
    log.warn(`could not fan out ${payload.type} notifications: ${error.message}`);
    return [];
  }
}

export const notify = { create, many };

export default notify;
