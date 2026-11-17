import mongoose from "mongoose";
import { env } from "./env.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("db");

/**
 * Connects to MongoDB and *fails the boot* if it cannot.
 *
 * The previous version swallowed connection errors, so the server would
 * start, accept traffic and then fail every single database request with a
 * confusing 500. Exiting instead lets the platform (Render, Docker, pm2)
 * restart the process, which is the behaviour that actually recovers.
 */
export default async function connectDB() {
  mongoose.set("strictQuery", true);
  // How long a command waits for a connection before giving up. The
  // 10-second default turns a brief outage into a request that appears
  // to hang; 2.5s fails fast enough for a client to show a real error
  // and still rides out a momentary reconnect.
  mongoose.set("bufferTimeoutMS", 2500);
  // Indexes are declared in the schemas. Building them automatically is
  // right for development; in production they should be created once by a
  // deploy step rather than on every cold start.
  mongoose.set("autoIndex", !env.isProduction);

  mongoose.connection.on("connected", () => log.info("MongoDB connected"));
  mongoose.connection.on("error", (error) => log.error("MongoDB error", error.message));
  mongoose.connection.on("disconnected", () => log.warn("MongoDB disconnected"));

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
    });
    return mongoose.connection;
  } catch (error) {
    log.error(`Could not connect to MongoDB: ${error.message}`);

    // Escape hatch for frontend work: the API still serves category
    // metadata and live OpenStreetMap search without a database, so a UI
    // developer does not need Mongo running. Everything that touches
    // stored data (accounts, reviews, bookings) will correctly fail.
    // Never set this in production.
    if (env.allowStartWithoutDb) {
      log.warn(
        "ALLOW_START_WITHOUT_DB is set - continuing without a database. " +
          "Search and categories will work; anything that reads or writes stored data will not."
      );
      return null;
    }

    process.exit(1);
  }
}

/**
 * Ensures every schema-declared index exists. Intended to be run once per
 * deploy (`npm run ensure-indexes`) when autoIndex is off in production.
 */
export async function ensureIndexes() {
  const results = [];
  for (const [name, model] of Object.entries(mongoose.models)) {
    await model.createIndexes();
    results.push(name);
  }
  return results;
}
