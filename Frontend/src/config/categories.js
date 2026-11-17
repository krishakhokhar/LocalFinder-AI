/**
 * Fallback category list, rendered immediately while the real catalogue
 * loads from /api/services/categories. Keeping it here means the filter
 * rail never appears empty, even on a cold start or an API hiccup.
 *
 * Keys mirror backend/config/categories.js.
 */
export const BUILT_IN_CATEGORY_FALLBACK = [
  { key: "all", label: "All" },
  { key: "salon", label: "Salon & Beauty" },
  { key: "restaurant", label: "Food & Dining" },
  { key: "spa", label: "Spa & Gym" },
  { key: "plumber", label: "Plumber" },
  { key: "electrician", label: "Electrician" },
  { key: "car", label: "Car Service" },
  { key: "health", label: "Health" },
];

export default BUILT_IN_CATEGORY_FALLBACK;
