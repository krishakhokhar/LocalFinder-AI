/**
 * Routes that exist in the router right now.
 *
 * The account menu filters itself against this set, so a navigation entry
 * can never point at a page that has not been built. Each area adds its
 * path here when it ships.
 */
export const AVAILABLE_ROUTES = new Set(["/favorites", "/account", "/owner", "/bookings", "/notifications", "/admin"]);

export default AVAILABLE_ROUTES;
