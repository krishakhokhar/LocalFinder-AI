import dotenv from "dotenv";

dotenv.config();

const { assertEnv, env } = await import("./config/env.js");
const { createLogger } = await import("./utils/logger.js");

const log = createLogger("server");

try {
  assertEnv();
} catch (error) {
  log.error(error.message);
  process.exit(1);
}

const { default: connectDB } = await import("./config/db.js");
const { createApp } = await import("./app.js");

await connectDB();

const app = createApp();

// Appointment reminders and stale-booking cleanup. Disabled with
// ENABLE_REMINDERS=false, which is what a multi-instance deployment
// should do before moving the sweep to a platform cron job.
if (process.env.ENABLE_REMINDERS !== "false") {
  const { startReminderSweep } = await import("./services/reminderService.js");
  startReminderSweep();
}

const server = app.listen(env.port, () => {
  log.info(`LocalFinder API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

/** Graceful shutdown so in-flight requests finish and Mongo closes cleanly. */
function shutdown(signal) {
  log.info(`${signal} received, shutting down`);
  server.close(async () => {
    const mongoose = await import("mongoose");
    await mongoose.default.connection.close();
    log.info("Shutdown complete");
    process.exit(0);
  });
  // Don't hang forever if a socket refuses to close.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled promise rejection", reason);
});
