import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Business from "../models/Business.js";
import { notify } from "./notificationService.js";
import { formatDateTime } from "../utils/datetime.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("reminders");

const WINDOW_HOURS = 24;
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Appointment reminders.
 *
 * A sweep rather than a per-booking timer: timers do not survive a
 * restart, and a platform like Render restarts on every deploy. Querying
 * for "confirmed, starting soon, not yet reminded" is stateless, so a
 * restart at any moment costs nothing and nothing is sent twice -
 * `reminderSentAt` is set in the same update that selects the booking.
 *
 * The sweep is driven by an in-process interval, which is right for a
 * single instance. If this is ever scaled to several instances, move it
 * to the platform's scheduler (a Render Cron Job hitting an authenticated
 * endpoint) so the work is not duplicated per instance.
 */
export async function sendDueReminders({ now = new Date() } = {}) {
  if (mongoose.connection.readyState !== 1) return { sent: 0, skipped: "database not connected" };

  const horizon = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  const due = await Booking.find({
    status: "confirmed",
    reminderSentAt: null,
    startAt: { $gt: now, $lte: horizon },
  })
    .limit(200)
    .populate("business", "name owner")
    .lean();

  let sent = 0;

  for (const booking of due) {
    // Claim the booking before sending, so a concurrent sweep cannot
    // send the same reminder twice.
    const claimed = await Booking.findOneAndUpdate(
      { _id: booking._id, reminderSentAt: null },
      { reminderSentAt: new Date() },
      { new: true }
    ).lean();
    if (!claimed) continue;

    const when = formatDateTime(booking.startAt, booking.tzOffsetMinutes);

    await notify.create(booking.customer, {
      type: "booking_reminder",
      title: "Appointment tomorrow",
      body: `${booking.service.name} at ${booking.business?.name || "your appointment"} on ${when}.`,
      link: "/bookings",
      data: { bookingId: String(booking._id) },
    });

    if (booking.business?.owner) {
      await notify.create(booking.business.owner, {
        type: "booking_reminder",
        title: "Appointment tomorrow",
        body: `${booking.service.name} on ${when}.`,
        link: "/owner/bookings",
        data: { bookingId: String(booking._id) },
      });
    }

    sent += 1;
  }

  if (sent > 0) log.info(`sent ${sent} appointment reminder(s)`);
  return { sent };
}

/**
 * Marks confirmed appointments whose end time has long passed.
 *
 * Without this, a booking the owner forgot to close stays "confirmed"
 * forever, blocks the customer from reviewing, and keeps appearing as
 * upcoming. Six hours past the end is a conservative line - long enough
 * that a running-late appointment is not closed out from under anyone.
 */
export async function closeStaleBookings({ now = new Date() } = {}) {
  if (mongoose.connection.readyState !== 1) return { closed: 0 };

  const cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const result = await Booking.updateMany(
    { status: "confirmed", endAt: { $lt: cutoff } },
    { status: "completed", completedAt: new Date(), $unset: { slotKey: "" } }
  );

  if (result.modifiedCount > 0) {
    log.info(`auto-completed ${result.modifiedCount} past appointment(s)`);
  }
  return { closed: result.modifiedCount };
}

let timer = null;

export function startReminderSweep() {
  if (timer) return timer;

  const run = async () => {
    try {
      await sendDueReminders();
      await closeStaleBookings();
    } catch (error) {
      log.error(`sweep failed: ${error.message}`);
    }
  };

  // First run shortly after boot, not immediately - let the database
  // connection settle first.
  setTimeout(run, 30 * 1000).unref();
  timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref();

  log.info(`reminder sweep running every ${SWEEP_INTERVAL_MS / 60000} minutes`);
  return timer;
}

export function stopReminderSweep() {
  if (timer) clearInterval(timer);
  timer = null;
}

// Business is imported so the populate() above has the model registered
// even when nothing else has touched it yet.
export { Business };
