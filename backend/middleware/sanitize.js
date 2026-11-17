/**
 * Strips MongoDB operator syntax out of request payloads.
 *
 * Without this, a body like `{"email": {"$gt": ""}}` becomes a query
 * operator once it reaches Mongoose and can match an arbitrary user. Keys
 * beginning with `$`, and keys containing `.` (which Mongo treats as a path
 * separator and which can be used for prototype-pollution style writes),
 * are removed outright rather than escaped - no legitimate request in this
 * API uses them.
 *
 * `express-mongo-sanitize` is not used because it rewrites `req.query`,
 * which is a read-only getter in Express 5. Only `req.body` and
 * `req.params` are mutated here; query strings are parsed into strings by
 * Express anyway and every query-reading endpoint validates/coerces them.
 */

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function clean(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => clean(item, depth + 1));
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".") || FORBIDDEN_KEYS.has(key)) continue;
    output[key] = clean(item, depth + 1);
  }
  return output;
}

export function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = clean(req.body);
  }
  if (req.params && typeof req.params === "object") {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === "string" && (value.startsWith("$") || value.includes("$"))) {
        req.params[key] = value.replace(/\$/g, "");
      }
    }
  }
  next();
}
