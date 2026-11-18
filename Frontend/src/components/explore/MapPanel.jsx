import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Layers, Navigation, Search } from "lucide-react";
import MarkerCluster from "./MarkerCluster";
import { basemapFor, hasCartoKey, nextBasemap, warnIfCartoKeyMissing } from "../../config/basemaps";
import { displayType } from "../../utils/categories";
import { directionsUrl, formatCategory, formatDistance, formatRating } from "../../utils/format";

// Leaflet's default icon URLs break under a bundler; point them at the CDN
// copies once, at module load.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Reported once at module load rather than on every render.
warnIfCartoKeyMissing();

// No hardcoded city. Opening the map on a specific place implies the user
// is there, which is a claim we cannot make until geolocation succeeds.
// Until then the map shows a deliberately neutral world view.
const NEUTRAL_CENTER = [20, 0];
const NEUTRAL_ZOOM = 2;
const LOCATED_ZOOM = 15;

const userIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:26px;height:26px;">
      <div style="position:absolute;inset:0;background:rgba(37,99,235,.28);border-radius:50%;animation:lfPulse 1.9s ease-out infinite;"></div>
      <div style="position:absolute;top:5px;left:5px;width:16px;height:16px;background:#2563EB;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(15,23,42,.4);"></div>
    </div>
    <style>@keyframes lfPulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(2.3);opacity:0}100%{transform:scale(1);opacity:0}}</style>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Pans (rather than jumps) whenever the focused coordinate changes. */
function PanTo({ center, zoom }) {
  const map = useMap();
  const last = useRef("");

  useEffect(() => {
    if (!center) return;
    const key = `${center[0]},${center[1]},${zoom ?? ""}`;
    if (key === last.current) return;
    last.current = key;
    map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.6 });
  }, [center, zoom, map]);

  return null;
}

/**
 * Watches for the user dragging or zooming away from the searched point
 * and surfaces a "search this area" action, the way map-first products do.
 * The search is never re-run automatically: panning the map should not
 * silently replace the results someone is reading.
 */
function AreaWatcher({ origin, onMoved }) {
  useMapEvents({
    moveend: (event) => {
      const center = event.target.getCenter();
      if (!origin) {
        onMoved({ lat: center.lat, lng: center.lng, moved: true });
        return;
      }
      const distance = event.target.distance(center, L.latLng(origin.lat, origin.lng));
      onMoved({ lat: center.lat, lng: center.lng, moved: distance > 400 });
    },
  });
  return null;
}

/**
 * Centres the map when the detected location arrives.
 *
 * This is load-bearing: react-leaflet reads MapContainer's `center` and
 * `zoom` once, at mount, and ignores every later change. Geolocation almost
 * always resolves *after* that first render, so without this the view stays
 * wherever it started no matter what the browser reports.
 */
function FollowLocation({ location }) {
  const map = useMap();
  const last = useRef("");

  useEffect(() => {
    if (!location) return;
    const key = `${location.lat},${location.lng}`;
    if (key === last.current) return;
    last.current = key;

    if (import.meta.env.DEV) {
      console.debug("[map] centering on detected location", {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy ?? null,
      });
    }
    map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), LOCATED_ZOOM), { duration: 0.8 });
  }, [location, map]);

  return null;
}

/** Exposes the Leaflet instance to the parent, for the recentre control. */
function MapRef({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

export default function MapPanel({
  places = [],
  userLocation = null,
  focusPosition = null,
  selectedId = null,
  onSelect,
  radius = 3000,
  onSearchArea,
  showRadius = true,
  locating = false,
  locationBlocked = false,
  className = "",
}) {
  const [mapInstance, setMapInstance] = useState(null);
  const [pendingArea, setPendingArea] = useState(null);
  // Full-colour Voyager cartography by default. The Layers button cycles
  // through colour -> light grey -> standard OSM.
  const [basemap, setBasemap] = useState("voyager");

  // Mount-time view only - FollowLocation/PanTo own every later move.
  const located = focusPosition || (userLocation ? [userLocation.lat, userLocation.lng] : null);
  const initialCenter = located || NEUTRAL_CENTER;
  const initialZoom = located ? LOCATED_ZOOM : NEUTRAL_ZOOM;

  const handleMoved = useCallback((info) => {
    setPendingArea(info.moved ? info : null);
  }, []);

  const recentre = () => {
    if (!mapInstance || !userLocation) return;
    mapInstance.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 0.6 });
    setPendingArea(null);
  };

  const searchHere = () => {
    if (!pendingArea || !onSearchArea) return;
    onSearchArea({ lat: pendingArea.lat, lng: pendingArea.lng });
    setPendingArea(null);
  };

  // Falls back to standard OSM tiles when no CARTO key is configured, so a
  // missing key degrades to a plain map rather than a watermarked one.
  const tiles = basemapFor(basemap);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
        style={{ background: "#eef2f7" }}
      >
        <MapRef onReady={setMapInstance} />
        <FollowLocation location={userLocation} />
        <PanTo center={focusPosition} zoom={focusPosition ? 16 : undefined} />
        <AreaWatcher origin={userLocation} onMoved={handleMoved} />

        {/* `key` forces a fresh layer when the basemap changes - Leaflet
            caches tiles per layer instance and would otherwise keep showing
            the previous source's tiles until they are panned out of view. */}
        <TileLayer
          key={tiles.id}
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={tiles.maxZoom}
        />

        {userLocation ? (
          <>
            {showRadius ? (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={radius}
                pathOptions={{
                  color: "#2563EB",
                  fillColor: "#60A5FA",
                  fillOpacity: 0.07,
                  weight: 1.5,
                  dashArray: "6 6",
                }}
              />
            ) : null}
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>
                <div className="px-3 py-2 font-sans text-sm font-semibold text-ink">You are here</div>
              </Popup>
            </Marker>
          </>
        ) : null}

        <MarkerCluster places={places} selectedId={selectedId} onSelect={onSelect} />

        {/* Rich popup for the selected result, anchored to its own pin. */}
        {places
          .filter((place) => place.placeId === selectedId)
          .map((place) => {
            const rating = formatRating(place.rating);
            return (
              <Popup
                key={place.placeId}
                position={[place.lat, place.lng]}
                autoPan
                closeButton={false}
                offset={[0, -34]}
              >
                <div className="w-56 p-3 font-sans">
                  <p className="font-display text-sm font-bold leading-snug text-ink">{place.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatCategory(displayType(place))}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                    {rating ? (
                      <span className="font-semibold text-ink-soft">
                        {rating} ({place.ratingCount})
                      </span>
                    ) : (
                      <span className="text-ink-faint">No reviews yet</span>
                    )}
                    {formatDistance(place) ? <span>· {formatDistance(place)}</span> : null}
                    {place.openNow === true ? (
                      <span className="font-semibold text-success-600">· Open</span>
                    ) : place.openNow === false ? (
                      <span className="font-semibold text-danger-600">· Closed</span>
                    ) : null}
                  </div>

                  {place.address ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{place.address}</p>
                  ) : null}

                  <div className="mt-2.5 flex gap-1.5">
                    <a
                      href={directionsUrl({
                        lat: place.lat,
                        lng: place.lng,
                        name: place.name,
                        originLat: userLocation?.lat,
                        originLng: userLocation?.lng,
                      })}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 px-2 py-1.5 text-xs font-semibold !text-white no-underline hover:bg-brand-700"
                    >
                      <Navigation className="h-3 w-3" aria-hidden="true" />
                      Directions
                    </a>
                    {place.businessId ? (
                      <a
                        href={`/business/${place.businessId}`}
                        className="inline-flex items-center justify-center rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold !text-ink-soft no-underline hover:bg-slate-50"
                      >
                        Details
                      </a>
                    ) : null}
                  </div>

                  <p className="mt-2 text-[10px] text-ink-faint">
                    {place.source === "localfinder" ? "Listed on LocalFinder" : "Source: OpenStreetMap"}
                  </p>
                </div>
              </Popup>
            );
          })}

        <style>{`.leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,.85)!important}`}</style>
      </MapContainer>

      {/* While no real position is known the map sits on a neutral world
          view, so say why rather than leaving an unexplained globe. */}
      {!userLocation ? (
        <div className="pointer-events-none absolute inset-0 z-[600] flex items-center justify-center p-4">
          <div className="pointer-events-auto max-w-xs rounded-card border border-line bg-surface/95 px-4 py-3 text-center shadow-lift backdrop-blur">
            {locating ? (
              <>
                <Crosshair className="mx-auto h-5 w-5 animate-pulse text-brand-600" aria-hidden="true" />
                <p className="mt-1.5 font-display text-sm font-bold text-ink">Detecting your location…</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  Allow access when your browser asks.
                </p>
              </>
            ) : (
              <>
                <Crosshair className="mx-auto h-5 w-5 text-ink-faint" aria-hidden="true" />
                <p className="mt-1.5 font-display text-sm font-bold text-ink">
                  {locationBlocked ? "Location is blocked" : "No location set"}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {locationBlocked
                    ? "Enable location in your browser, or zoom to your area and press “Search this area”."
                    : "Use “My location”, or zoom to your area and press “Search this area”."}
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Floating controls, kept clear of the Leaflet attribution. */}
      <div className="pointer-events-none absolute inset-0 z-[500]">
        {pendingArea && onSearchArea ? (
          <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2">
            <button
              type="button"
              onClick={searchHere}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-soft shadow-lift transition-colors hover:bg-slate-50"
            >
              <Search className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Search this area
            </button>
          </div>
        ) : null}

        <div className="pointer-events-auto absolute right-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => mapInstance?.zoomIn()}
            aria-label="Zoom in"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-lg font-semibold text-ink-soft shadow-soft transition-colors hover:bg-slate-50"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapInstance?.zoomOut()}
            aria-label="Zoom out"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-lg font-semibold text-ink-soft shadow-soft transition-colors hover:bg-slate-50"
          >
            &minus;
          </button>
          <button
            type="button"
            onClick={recentre}
            disabled={!userLocation}
            aria-label="Centre on my location"
            title={userLocation ? "Centre on my location" : "Share your location first"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft shadow-soft transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <Crosshair className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setBasemap((current) => nextBasemap(current))}
            disabled={!hasCartoKey}
            aria-label="Switch map style"
            title={
              hasCartoKey
                ? `Map style: ${tiles.label} - click to change`
                : "Only the standard map is available - no CARTO API key is configured"
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft shadow-soft transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
