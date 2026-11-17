import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin } from "lucide-react";
import Button from "../common/Button";
import useGeolocation from "../../hooks/useGeolocation";

const pinIcon = L.divIcon({
  className: "",
  html: `
    <div style="width:34px;height:34px;">
      <div style="width:34px;height:34px;background:#2563EB;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(15,23,42,.35);"></div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function ClickToPlace({ onPick }) {
  useMapEvents({
    click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

function Recentre({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16));
  }, [position, map]);
  return null;
}

/**
 * Pin-drop location picker for a business listing.
 *
 * The owner places the pin themselves rather than the app geocoding
 * their typed address: a geocoder puts a shop on the centre of its
 * street, which is what sends a customer to the wrong end of the market.
 * Dragging the pin is the one way to get a coordinate that is actually
 * the door.
 */
export default function LocationPicker({ value, onChange, error }) {
  const { request, isLocating } = useGeolocation();
  const [position, setPosition] = useState(value || null);

  useEffect(() => {
    if (value && (value.lat !== position?.lat || value.lng !== position?.lng)) {
      setPosition(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirror the parent's value only
  }, [value?.lat, value?.lng]);

  const place = (next) => {
    setPosition(next);
    onChange(next);
  };

  const useMyLocation = async () => {
    const coords = await request();
    if (coords) place({ lat: coords.lat, lng: coords.lng });
  };

  // Ahmedabad, purely as a starting view when no pin has been dropped.
  const center = position ? [position.lat, position.lng] : [23.0225, 72.5714];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-soft">
          Pin your exact location <span className="text-danger-500">*</span>
        </p>
        <Button type="button" variant="outline" size="xs" icon={Crosshair} onClick={useMyLocation} loading={isLocating}>
          Use my location
        </Button>
      </div>

      <div className={`overflow-hidden rounded-card border ${error ? "border-danger-300" : "border-line"}`}>
        <div className="h-64">
          <MapContainer center={center} zoom={position ? 16 : 12} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ClickToPlace onPick={place} />
            <Recentre position={position} />
            {position ? (
              <Marker
                position={[position.lat, position.lng]}
                icon={pinIcon}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const { lat, lng } = event.target.getLatLng();
                    place({ lat, lng });
                  },
                }}
              />
            ) : null}
          </MapContainer>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-slate-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <MapPin className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
            {position
              ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
              : "Tap the map to drop a pin, or drag it to adjust"}
          </p>
          {position ? (
            <button
              type="button"
              onClick={() => {
                setPosition(null);
                onChange(null);
              }}
              className="text-xs font-semibold text-ink-muted underline-offset-2 hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-faint">
          Customers get directions to this exact point, so place it on your door rather than the street.
        </p>
      )}
    </div>
  );
}
