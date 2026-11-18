/**
 * Basemap tile sources.
 *
 * CARTO's basemap CDN now requires an API key. Without one it still answers
 * HTTP 200 - but with a placeholder tile stamped "API KEY REQUIRED", so a
 * missing key cannot be detected from the network response. It has to be
 * caught here, from the presence of the environment variable.
 *
 * The key is a *publishable* credential: it ships in the browser bundle and
 * is visible in any network inspector, which is unavoidable for client-side
 * tiles. It is protected by domain restriction in the CARTO dashboard, not
 * by secrecy - so use a key restricted to localhost in development and a
 * separate one restricted to the production domain. It is still read from
 * the environment rather than hardcoded, so the two builds can differ and
 * no key is committed.
 */

const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY?.trim() || "";

export const hasCartoKey = Boolean(CARTO_KEY);

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

/** CARTO reads the key from `key=`, not `api_key=`. */
function cartoUrl(style) {
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`;
}

export const STANDARD_BASEMAP = {
  id: "standard",
  label: "Standard",
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: OSM_ATTRIBUTION,
  maxZoom: 19,
};

/**
 * The default. Voyager is CARTO's full-colour cartography: green parks,
 * blue water, amber arterial roads, cream residential streets, building
 * footprints and place labels.
 *
 * The previous default was `light_all` (Positron), which is a deliberately
 * desaturated grey style meant as a backdrop for data overlays. That - not
 * a CSS filter, opacity or a broken key - is why the map looked grey.
 */
export const VOYAGER_BASEMAP = {
  id: "voyager",
  label: "Colour",
  url: cartoUrl("rastertiles/voyager"),
  attribution: CARTO_ATTRIBUTION,
  maxZoom: 20,
};

/** Low-detail grey, kept as the alternative for a data-heavy view. */
export const LIGHT_BASEMAP = {
  id: "light",
  label: "Light",
  url: cartoUrl("light_all"),
  attribution: CARTO_ATTRIBUTION,
  maxZoom: 20,
};

const CARTO_STYLES = { voyager: VOYAGER_BASEMAP, light: LIGHT_BASEMAP };

/** Toggle order, so the Layers button cycles rather than flips. */
export const BASEMAP_CYCLE = ["voyager", "light", "standard"];

/**
 * The basemap to show for a given toggle position.
 *
 * Any CARTO style falls back to standard OSM tiles when no key is
 * configured, rather than rendering a map covered in "API KEY REQUIRED" -
 * a plain map is a better failure than a broken-looking one.
 */
export function basemapFor(id) {
  const carto = CARTO_STYLES[id];
  if (carto && hasCartoKey) return carto;
  if (carto && !hasCartoKey) return STANDARD_BASEMAP;
  return STANDARD_BASEMAP;
}

/** Next style in the cycle, skipping CARTO styles when there is no key. */
export function nextBasemap(id) {
  const order = hasCartoKey ? BASEMAP_CYCLE : ["standard"];
  const index = order.indexOf(id);
  return order[(index + 1) % order.length];
}

/** One-time console guidance, so a missing key is obvious while developing. */
export function warnIfCartoKeyMissing() {
  if (hasCartoKey || !import.meta.env.DEV) return;
  console.warn(
    "[basemap] VITE_CARTO_API_KEY is not set - falling back to standard OpenStreetMap tiles.\n" +
      "  CARTO basemaps now watermark every tile with 'API KEY REQUIRED' unless a key is sent.\n" +
      "  Fix: add VITE_CARTO_API_KEY=<your key> to Frontend/.env, then restart `npm run dev`\n" +
      "  (Vite only reads .env at startup). Get a free key at https://carto.com/basemaps/apikey"
  );
}

export default basemapFor;
