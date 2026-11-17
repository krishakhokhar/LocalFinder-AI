import {
  Banknote,
  Car,
  Coffee,
  Dumbbell,
  Fuel,
  LayoutGrid,
  Pill,
  Scissors,
  Sparkles,
  Stethoscope,
  Store,
  UtensilsCrossed,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * Category presentation: one icon and one colour per kind of place, used
 * identically by cards, map pins, filters and the AI assistant so a salon
 * always looks like a salon wherever it appears.
 *
 * Keys cover both our own category keys ("salon") and the raw OSM values
 * ("hairdresser", "fitness_centre"), because a result keeps its real OSM
 * type rather than being flattened into the filter that found it.
 */
const CONFIG = {
  all: { icon: LayoutGrid, label: "All", tint: "bg-slate-100 text-ink-muted", pin: "#64748B" },

  salon: { icon: Scissors, label: "Salon", tint: "bg-pink-50 text-pink-600", pin: "#EC4899" },
  hairdresser: { icon: Scissors, label: "Hair Salon", tint: "bg-pink-50 text-pink-600", pin: "#EC4899" },
  beauty: { icon: Sparkles, label: "Beauty", tint: "bg-pink-50 text-pink-600", pin: "#EC4899" },

  restaurant: { icon: UtensilsCrossed, label: "Restaurant", tint: "bg-orange-50 text-orange-600", pin: "#F97316" },
  cafe: { icon: Coffee, label: "Cafe", tint: "bg-amber-50 text-amber-700", pin: "#D97706" },
  fast_food: { icon: UtensilsCrossed, label: "Fast Food", tint: "bg-orange-50 text-orange-600", pin: "#F97316" },

  spa: { icon: Sparkles, label: "Spa", tint: "bg-ai-50 text-ai-600", pin: "#8B5CF6" },
  fitness_centre: { icon: Dumbbell, label: "Gym", tint: "bg-ai-50 text-ai-600", pin: "#7C3AED" },

  plumber: { icon: Wrench, label: "Plumber", tint: "bg-warning-50 text-warning-700", pin: "#F59E0B" },
  electrician: { icon: Zap, label: "Electrician", tint: "bg-brand-50 text-brand-700", pin: "#2563EB" },

  car: { icon: Car, label: "Car Service", tint: "bg-success-50 text-success-700", pin: "#10B981" },
  car_repair: { icon: Car, label: "Car Repair", tint: "bg-success-50 text-success-700", pin: "#10B981" },

  health: { icon: Stethoscope, label: "Health", tint: "bg-danger-50 text-danger-600", pin: "#EF4444" },
  hospital: { icon: Stethoscope, label: "Hospital", tint: "bg-danger-50 text-danger-600", pin: "#EF4444" },
  clinic: { icon: Stethoscope, label: "Clinic", tint: "bg-danger-50 text-danger-600", pin: "#EF4444" },
  doctors: { icon: Stethoscope, label: "Doctor", tint: "bg-danger-50 text-danger-600", pin: "#EF4444" },
  pharmacy: { icon: Pill, label: "Pharmacy", tint: "bg-success-50 text-success-700", pin: "#059669" },

  finance: { icon: Banknote, label: "Bank", tint: "bg-indigo-50 text-indigo-600", pin: "#6366F1" },
  bank: { icon: Banknote, label: "Bank", tint: "bg-indigo-50 text-indigo-600", pin: "#6366F1" },
  atm: { icon: Banknote, label: "ATM", tint: "bg-indigo-50 text-indigo-600", pin: "#6366F1" },

  fuel: { icon: Fuel, label: "Fuel", tint: "bg-slate-100 text-ink-soft", pin: "#475569" },
};

const FALLBACK = { icon: Store, label: "Service", tint: "bg-slate-100 text-ink-muted", pin: "#2563EB" };

/**
 * Leaflet renders marker contents from an HTML string, so the React icon
 * components cannot be used inside a pin. These are the same glyphs drawn
 * as minimal inline SVG - kept tiny and stroke-based so they stay legible
 * at 14px and inherit the pin's white colour.
 */
const SVG_WRAP = (body) =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const PIN_SVG = {
  scissors: SVG_WRAP(
    '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.1" y2="15.9"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="8.1" y1="8.1" x2="12" y2="12"/>'
  ),
  utensils: SVG_WRAP(
    '<path d="M3 2v7a3 3 0 0 0 6 0V2"/><line x1="6" y1="9" x2="6" y2="22"/><path d="M17 2v20"/><path d="M21 2v6a4 4 0 0 1-4 4"/>'
  ),
  dumbbell: SVG_WRAP(
    '<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3 9v6"/><path d="M21 9v6"/><line x1="6.5" y1="12" x2="17.5" y2="12"/>'
  ),
  wrench: SVG_WRAP(
    '<path d="M14.7 6.3a4 4 0 1 0 5 5L21 21l-3 0-9.3-9.3a4 4 0 0 1-5-5L6 4l3 3Z"/>'
  ),
  zap: SVG_WRAP('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  car: SVG_WRAP(
    '<path d="M5 17h14M4 13l1.5-5h13L20 13v4H4v-4Z"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>'
  ),
  health: SVG_WRAP('<path d="M12 5v14M5 12h14"/>'),
  bank: SVG_WRAP('<path d="M3 10h18M5 10v9m14-9v9M3 19h18M12 3 3 8h18L12 3Z"/>'),
  fuel: SVG_WRAP('<path d="M3 21h10V3H3v18Zm10-9h3a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2"/>'),
  store: SVG_WRAP('<path d="M4 9h16v11H4V9Zm0 0 1.5-5h13L20 9M9 20v-6h6v6"/>'),
  sparkles: SVG_WRAP('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>'),
};

const SVG_FOR_CATEGORY = {
  salon: "scissors",
  hairdresser: "scissors",
  beauty: "sparkles",
  restaurant: "utensils",
  cafe: "utensils",
  fast_food: "utensils",
  spa: "sparkles",
  fitness_centre: "dumbbell",
  plumber: "wrench",
  electrician: "zap",
  car: "car",
  car_repair: "car",
  health: "health",
  hospital: "health",
  clinic: "health",
  doctors: "health",
  pharmacy: "health",
  finance: "bank",
  bank: "bank",
  atm: "bank",
  fuel: "fuel",
};

export function pinSvg(key) {
  return PIN_SVG[SVG_FOR_CATEGORY[String(key || "").toLowerCase()] || "store"];
}

/** Icon names the API sends for admin-managed categories. */
const ICON_BY_NAME = {
  "layout-grid": LayoutGrid,
  scissors: Scissors,
  utensils: UtensilsCrossed,
  dumbbell: Dumbbell,
  wrench: Wrench,
  zap: Zap,
  car: Car,
  stethoscope: Stethoscope,
  store: Store,
  sparkles: Sparkles,
  coffee: Coffee,
  banknote: Banknote,
  pill: Pill,
  fuel: Fuel,
};

export function categoryConfig(key) {
  const base = key ? CONFIG[String(key).toLowerCase()] || FALLBACK : FALLBACK;
  return { ...base, svg: pinSvg(key) };
}

export function iconForName(name) {
  return ICON_BY_NAME[name] || Store;
}

/**
 * The best type to display for a result: its real OSM type when there is
 * one, falling back to our category. A gym found by the "Spa/Gym" filter
 * stays a gym.
 */
export function displayType(place) {
  return place?.osmType || place?.category || null;
}

export default categoryConfig;
