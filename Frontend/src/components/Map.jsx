import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Pulsing blue user dot
const userIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:28px;height:28px;">
      <div style="
        position:absolute;top:0;left:0;
        width:28px;height:28px;
        background:rgba(59,130,246,0.3);
        border-radius:50%;
        animation:lfPulse 1.8s ease-out infinite;
      "></div>
      <div style="
        position:absolute;top:6px;left:6px;
        width:16px;height:16px;
        background:#3b82f6;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
      "></div>
    </div>
    <style>
      @keyframes lfPulse {
        0%   { transform:scale(1);   opacity:0.7; }
        70%  { transform:scale(2.2); opacity:0;   }
        100% { transform:scale(1);   opacity:0;   }
      }
    </style>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

// Colored pin per service type
const TYPE_COLORS = {
  salon: "#ec4899", hairdresser: "#ec4899",
  plumber: "#eab308",
  electrician: "#3b82f6",
  restaurant: "#f97316", cafe: "#f97316", fast_food: "#f97316",
  spa: "#a855f7", fitness_centre: "#a855f7",
  car: "#22c55e", car_repair: "#22c55e",
  hospital: "#ef4444", clinic: "#ef4444", pharmacy: "#22c55e",
  bank: "#6366f1",
};

const TYPE_EMOJI = {
  salon: "✂️", hairdresser: "✂️",
  plumber: "🔧",
  electrician: "⚡",
  restaurant: "🍽️", cafe: "☕", fast_food: "🍔",
  spa: "💆", fitness_centre: "🏋️",
  car: "🚗", car_repair: "🚗",
  hospital: "🏥", pharmacy: "💊", bank: "🏦",
};

function makePin(type, selected) {
  const color = TYPE_COLORS[type] || "#6366f1";
  const emoji = TYPE_EMOJI[type] || "📍";
  const size = selected ? 40 : 32;
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:${color};
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 3px 12px rgba(0,0,0,0.35);
        display:flex; align-items:center; justify-content:center;
        ${selected ? `box-shadow:0 0 0 5px ${color}44, 0 3px 12px rgba(0,0,0,0.35);` : ""}
      ">
        <span style="transform:rotate(45deg); font-size:${selected ? 18 : 14}px; line-height:1;">
          ${emoji}
        </span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 4],
  });
}

// Auto-pan map when center changes
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 15, { animate: true });
  }, [center?.toString()]);
  return null;
}

export default function MapComponent({
  services = [],
  selectedPosition,
  userLocation,
  selectedService,
}) {
  const fallback = [23.0225, 72.5714];
  const center = selectedPosition || (userLocation ? userLocation : fallback);

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <ChangeView center={center} />

      {/* Base map tiles */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* User location: pulse ring + blue dot */}
      {userLocation && (
        <>
          <Circle
            center={userLocation}
            radius={200}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#93c5fd",
              fillOpacity: 0.18,
              weight: 1.5,
              dashArray: "4 4",
            }}
          />
          <Marker position={userLocation} icon={userIcon}>
            <Popup>
              <b>📍 You are here</b>
            </Popup>
          </Marker>
        </>
      )}

      {/* Service markers */}
      {services.map((svc, i) => (
        <Marker
          key={i}
          position={svc.position}
          icon={makePin(svc.type, selectedService?.name === svc.name)}
        >
          <Popup maxWidth={230} minWidth={180}>
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: "13px", lineHeight: "1.6" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "2px" }}>{svc.name}</div>
              <div style={{ color: "#6b7280", marginBottom: "4px" }}>
                {svc.type?.replace(/_/g, " ")}
              </div>
              <div>⭐ {svc.rating} &nbsp;&nbsp; 📍 {svc.distance}</div>
              {svc.address && <div>🏠 {svc.address}</div>}
              {svc.phone && (
                <div>
                  <a href={`tel:${svc.phone}`} style={{ color: "#3b82f6" }}>
                    📞 {svc.phone}
                  </a>
                </div>
              )}
              {svc.opening_hours && <div>🕐 {svc.opening_hours}</div>}
              {svc.website && (
                <div>
                  <a href={svc.website} target="_blank" rel="noreferrer" style={{ color: "#3b82f6" }}>
                    🌐 Website
                  </a>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
