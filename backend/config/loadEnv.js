/**
 * Loads .env before anything else reads process.env.
 *
 * Why this file exists
 * --------------------
 * `config/env.js` snapshots process.env when it is first evaluated:
 *
 *     export const env = { mongoUri: process.env.MONGO_URI, ... }
 *
 * In an ES module, every static `import` is evaluated before the first
 * line of the importing module's own body runs. So this, which looks
 * obviously correct, does not work:
 *
 *     import dotenv from "dotenv";
 *     dotenv.config();              // <- runs third
 *     import connectDB from "../config/db.js";   // <- evaluated first,
 *                                                //    and it imports env.js
 *
 * By the time dotenv.config() runs, env.js has already captured an empty
 * process.env, so env.mongoUri is undefined and the script dies with
 * `The "uri" parameter to openUri() must be a string, got "undefined"` -
 * which reads like a bad connection string rather than a load-order bug.
 *
 * Importing *this* module first fixes it, because module dependencies are
 * evaluated depth-first in source order: dotenv.config() has finished
 * before the next import on the line below is even looked at.
 *
 *     import "../config/loadEnv.js";   // must stay the first import
 *     import connectDB from "../config/db.js";
 *
 * server.js solves the same problem a different way, with dynamic
 * `await import()` after dotenv.config(). Either is fine; this one keeps
 * the small scripts readable.
 */
import dotenv from "dotenv";

dotenv.config();
