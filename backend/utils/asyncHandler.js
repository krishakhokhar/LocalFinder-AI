/**
 * Wraps an async route handler so a rejected promise reaches Express'
 * error middleware instead of hanging the request.
 *
 * Express 5 forwards rejected promises automatically, but wrapping is kept
 * explicit so the behaviour does not depend on the framework version and so
 * handlers read identically throughout the codebase.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
