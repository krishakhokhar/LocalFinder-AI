/**
 * The categories the product ships with.
 *
 * Keys match the OSM tag map in utils/overpass.js so one value drives both
 * registered-business filtering and external place search. Admins can add
 * more through the Category collection; these are the fallback so a fresh
 * database still renders a working UI, and the seed for the catalogue.
 *
 * `icon` names are lucide-react icons, resolved on the frontend.
 */
export const BUILT_IN_CATEGORIES = [
  { key: "all", label: "All", icon: "layout-grid", order: 0, description: "Everything nearby" },
  { key: "salon", label: "Salon & Beauty", icon: "scissors", order: 10, description: "Haircuts, beauty parlours, grooming" },
  { key: "restaurant", label: "Food & Dining", icon: "utensils", order: 20, description: "Restaurants, cafes and takeaways" },
  { key: "spa", label: "Spa & Gym", icon: "dumbbell", order: 30, description: "Fitness centres, spas and wellness" },
  { key: "shopping", label: "Shopping & Essentials", icon: "shopping-cart", order: 40, description: "Supermarkets, grocery, malls and daily needs" },
  { key: "electrician", label: "Electrician", icon: "zap", order: 50, description: "Wiring, fittings and electrical repair" },
  { key: "car", label: "Car Service", icon: "car", order: 60, description: "Garages, servicing and repair" },
  { key: "health", label: "Health", icon: "stethoscope", order: 70, description: "Clinics, hospitals and pharmacies" },
  { key: "other", label: "Other", icon: "store", order: 999, description: "Everything else" },
];

export const CATEGORY_LABELS = Object.fromEntries(
  BUILT_IN_CATEGORIES.map((category) => [category.key, category.label])
);

export function labelForCategory(key) {
  if (!key) return "Service";
  return (
    CATEGORY_LABELS[key] ||
    String(key)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}
