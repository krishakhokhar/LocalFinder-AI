import AnalyticsEvent, { dayKey } from "../models/AnalyticsEvent.js";
import Business from "../models/Business.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("analytics");

/**
 * Records an event without ever affecting the request that triggered it.
 *
 * Analytics is strictly best-effort: the promise is intentionally not
 * awaited by callers and a failure is logged, never thrown. A dashboard
 * losing one data point is acceptable; a search failing because of a
 * logging write is not.
 */
export function recordEvent({ type, business = null, user = null, placeId = null, meta = {} }) {
  return AnalyticsEvent.create({
    type,
    business,
    user,
    placeId,
    day: dayKey(),
    meta,
  }).catch((error) => {
    log.warn(`could not record ${type}: ${error.message}`);
    return null;
  });
}

/**
 * Records a profile view and bumps the business's cached counter.
 *
 * The counter is denormalised so the owner dashboard and business cards can
 * show a total without aggregating the event log on every read.
 */
export function recordBusinessView({ businessId, user = null, placeId = null }) {
  if (!businessId) return recordEvent({ type: "business_view", user, placeId });
  return Promise.all([
    recordEvent({ type: "business_view", business: businessId, user, placeId }),
    Business.findByIdAndUpdate(businessId, { $inc: { viewCount: 1 } }).catch(() => null),
  ]);
}

/** Daily counts of one or more event types for a business, oldest first. */
export async function dailySeries({ businessId = null, types, days = 30 }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match = { type: { $in: types }, createdAt: { $gte: since } };
  if (businessId) match.business = businessId;

  const rows = await AnalyticsEvent.aggregate([
    { $match: match },
    { $group: { _id: { day: "$day", type: "$type" }, count: { $sum: 1 } } },
    { $sort: { "_id.day": 1 } },
  ]);

  // Fill the gaps so a chart never draws a misleading straight line across
  // days that simply had no events.
  const byDay = new Map();
  for (let index = days - 1; index >= 0; index -= 1) {
    const key = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    byDay.set(key, Object.fromEntries(types.map((type) => [type, 0])));
  }
  for (const row of rows) {
    const bucket = byDay.get(row._id.day);
    if (bucket) bucket[row._id.type] = row.count;
  }

  return [...byDay.entries()].map(([day, counts]) => ({ day, ...counts }));
}

/** Totals per event type for a business over a window. */
export async function totalsByType({ businessId = null, days = 30 }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match = { createdAt: { $gte: since } };
  if (businessId) match.business = businessId;

  const rows = await AnalyticsEvent.aggregate([
    { $match: match },
    { $group: { _id: "$type", count: { $sum: 1 } } },
  ]);

  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}
