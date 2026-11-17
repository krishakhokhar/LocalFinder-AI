/**
 * Central, validated access to environment configuration.
 *
 * Everything that reads process.env goes through here so that:
 *  - a missing critical variable fails loudly at boot instead of
 *    silently producing broken behaviour at request time,
 *  - every optional variable has one documented default,
 *  - no secret is ever read from more than one place.
 */

const required = ["MONGO_URI", "JWT_SECRET"];

function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  get isProduction() {
    return this.nodeEnv === "production";
  },
  port: int(process.env.PORT, 5000),

  mongoUri: process.env.MONGO_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  corsOrigins: list(process.env.CORS_ORIGIN),

  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-20b",

  // Uploads: local disk by default (fine for development), Cloudinary when
  // configured. Render's filesystem is ephemeral, so production deployments
  // should set the Cloudinary variables - see README.
  uploadDriver: process.env.UPLOAD_DRIVER || (process.env.CLOUDINARY_CLOUD_NAME ? "cloudinary" : "local"),
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxUploadBytes: int(process.env.MAX_UPLOAD_BYTES, 3 * 1024 * 1024),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || "localfinder",
  },

  publicUrl: process.env.PUBLIC_URL || "",

  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),

  // Development escape hatch - see config/db.js. Ignored in production.
  allowStartWithoutDb:
    process.env.ALLOW_START_WITHOUT_DB === "true" && process.env.NODE_ENV !== "production",
};

/**
 * Called once from server.js before anything else boots. Kept out of module
 * scope so that tests / tooling can import the app without a full env.
 */
export function assertEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy backend/.env.example to backend/.env and fill them in.`
    );
  }
  // Atlas hands you a connection string with the password left as a
  // <db_password> placeholder. Pasting it unedited produces
  // "MongoServerError: bad auth : authentication failed" at connect time,
  // which reads like a wrong password rather than an unfilled template.
  const placeholders = (env.mongoUri || "").match(/<[^>@/]*>/g);
  if (placeholders) {
    const message =
      `MONGO_URI still contains a placeholder (${placeholders.join(", ")}). ` +
      `Replace it with the real value - in Atlas: Database > Connect > Drivers, and if you have ` +
      `forgotten the password, Database Access > Edit > Edit Password. URL-encode any of ` +
      `: / ? # [ ] @ in it.`;
    // Don't take away the no-database escape hatch: someone working on the
    // frontend has deliberately said they do not need Mongo, so an unfilled
    // template is a warning for them rather than a reason to refuse to boot.
    if (env.allowStartWithoutDb) console.warn(`[env] ${message}`);
    else throw new Error(message);
  }

  if (env.jwtSecret && env.jwtSecret.length < 16) {
    throw new Error("JWT_SECRET is too short - use at least 32 random characters.");
  }
  if (!env.groqApiKey) {
    console.warn("[env] GROQ_API_KEY is not set - AI search and chat will return a graceful fallback.");
  }
}
