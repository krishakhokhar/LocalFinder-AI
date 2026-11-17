/**
 * One response shape for the whole API.
 *
 * Success:  { success: true,  ...payload }
 * Failure:  { success: false, message, code?, errors? }
 *
 * The existing clients already expect `success` + `message`, so this keeps
 * every current consumer working while giving newer endpoints a machine
 * readable `code`.
 */

export function ok(res, payload = {}, status = 200) {
  return res.status(status).json({ success: true, ...payload });
}

export function created(res, payload = {}) {
  return ok(res, payload, 201);
}

export function fail(res, status, message, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}

/**
 * Error carrying an HTTP status, thrown from controllers/services and
 * translated by the central error handler. Using a real Error subclass means
 * stack traces stay useful.
 */
export class ApiError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options.code;
    this.errors = options.errors;
    this.expose = true;
  }

  static badRequest(message, options) {
    return new ApiError(400, message, options);
  }
  static unauthorized(message = "Not authorized") {
    return new ApiError(401, message);
  }
  static forbidden(message = "You do not have permission to do that") {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }
  static conflict(message, options) {
    return new ApiError(409, message, options);
  }
  static tooMany(message = "Too many requests") {
    return new ApiError(429, message);
  }
}
