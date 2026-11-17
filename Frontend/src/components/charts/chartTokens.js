/**
 * Chart design tokens.
 *
 * The categorical order below was chosen by running the palette through
 * the colour validator rather than by eye. With the brand blue in slot 1,
 * these three clear every gate on the all-pairs list against the light
 * surface:
 *
 *   lightness band  PASS   chroma floor      PASS
 *   CVD separation  PASS   (worst ΔE 9.2 deutan, target >= 8)
 *   normal vision   PASS   (worst ΔE 27.6, floor 15)
 *   contrast        WARN   aqua at 2.74:1 against white
 *
 * The contrast warning is why every chart here ships a legend *and* a
 * table view: relief is required, not optional, when a series colour sits
 * under 3:1. The brand violet is deliberately absent - against the brand
 * blue it scored ΔE 2.3 for protanopia, meaning a red-blind reader could
 * not tell the two series apart at all.
 *
 * Slots are assigned in fixed order and never cycled. Past three series a
 * chart folds the rest into "Other" or splits into small multiples.
 */
export const SERIES_COLORS = ["#2563EB", "#EB6834", "#1BAF7A"];

export const CHART = {
  surface: "#FFFFFF",
  grid: "#E2E8F0",
  axis: "#CBD5E1",
  textPrimary: "#172554",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",

  lineWidth: 2,
  markerRadius: 4,
  ringWidth: 2,
  barMaxThickness: 24,
  barRadius: 4,
  areaOpacity: 0.1,
};

/** Clean axis ticks: 0 / 5 / 10, never 0 / 3.33 / 6.67. */
export function niceTicks(maxValue, count = 4) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return [0, 1];

  const rough = maxValue / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;

  const ticks = [];
  for (let value = 0; value <= maxValue + step * 0.001; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return ticks.length > 1 ? ticks : [0, step];
}

/** Full numbers below 10,000, compact above - one style per axis. */
export function formatTick(value, max) {
  if (max >= 10000) {
    if (value >= 1000000) return `${Math.round(value / 100000) / 10}M`;
    if (value >= 1000) return `${Math.round(value / 100) / 10}K`;
  }
  return value.toLocaleString("en-IN");
}
