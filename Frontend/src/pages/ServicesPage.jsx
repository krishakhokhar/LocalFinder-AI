import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import ServiceCard from "../components/ServiceCard";
import MapComponent from "../components/Map";
import { API_BASE_URL } from "../config/api";
import {
  FaMapMarkerAlt, FaLocationArrow, FaSpinner,
  FaSearch, FaExclamationTriangle, FaRedo,
  FaCut, FaTools, FaBolt, FaUtensils, FaSpa, FaCar, FaStore
} from "react-icons/fa";

const CATEGORIES = [
  { key: "all",         label: "All",         icon: <FaStore /> },
  { key: "salon",       label: "Salon",       icon: <FaCut /> },
  { key: "plumber",     label: "Plumber",     icon: <FaTools /> },
  { key: "electrician", label: "Electrician", icon: <FaBolt /> },
  { key: "restaurant",  label: "Restaurant",  icon: <FaUtensils /> },
  { key: "spa",         label: "Spa/Gym",     icon: <FaSpa /> },
  { key: "car",         label: "Car Service", icon: <FaCar /> },
];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
}

async function fetchOverpass(lat, lng, catKey, radiusM = 3000) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    category: catKey,
    radius: String(radiusM),
  });
  const res = await fetch(`${API_BASE_URL}/api/services/nearby?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Could not fetch nearby services");
  }
  const results = (data.elements || [])
    .filter((el) => el.tags?.name)
    .map((el) => {
      const slat = el.lat ?? el.center?.lat;
      const slng = el.lon ?? el.center?.lon;
      const dist = haversine(lat, lng, slat, slng);
      return {
        name: el.tags.name,
        type:
          catKey !== "all"
            ? catKey
            : el.tags.amenity || el.tags.craft || el.tags.shop || el.tags.leisure || "service",
        phone: el.tags.phone || el.tags["contact:phone"] || null,
        address: el.tags["addr:street"]
          ? `${el.tags["addr:street"]}${el.tags["addr:housenumber"] ? " " + el.tags["addr:housenumber"] : ""}`
          : null,
        website: el.tags.website || el.tags["contact:website"] || null,
        opening_hours: el.tags.opening_hours || null,
        rating: (3.5 + Math.random() * 1.5).toFixed(1),
        distance: dist + " km",
        distNum: parseFloat(dist),
        position: [slat, slng],
      };
    })
    .sort((a, b) => a.distNum - b.distNum);

  return { results, degradedMessage: data.degraded ? data.message : null };
}

export default function ServicesPage({ selectedPosition }) {
  const routerLocation = useLocation();
  const params = new URLSearchParams(routerLocation.search);
  const typeFromURL = params.get("type") || "all";
  const initCat = CATEGORIES.find((c) => c.key === typeFromURL) ? typeFromURL : "all";

  const [activeCategory, setActiveCategory] = useState(initCat);
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapCenter, setMapCenter] = useState(selectedPosition || null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  /* ── fetch Overpass results ── */
  const fetchServices = useCallback(async (lat, lng, cat) => {
    setLoading(true);
    setError("");
    setServices([]);
    try {
      const { results, degradedMessage } = await fetchOverpass(lat, lng, cat);
      setServices(results);
      if (degradedMessage) setError(degradedMessage);
      else if (results.length === 0)
        setError("No services found within 3 km. Try a different category.");
    } catch {
      setError("Could not fetch services. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── get user location ── */
  const getLocation = useCallback(() => {
    if (!navigator.geolocation)
      return setError("Geolocation is not supported by your browser.");
    setLocLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        setMapCenter([lat, lng]);
        setLocationGranted(true);
        setLocLoading(false);
        fetchServices(lat, lng, activeCategory);
      },
      () => {
        setError("Location permission denied. Please allow access and try again.");
        setLocLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, [activeCategory, fetchServices]);

  /* auto-request on mount */
  useEffect(() => { getLocation(); }, []);

  /* refetch on category change */
  useEffect(() => {
    if (userLocation) fetchServices(userLocation.lat, userLocation.lng, activeCategory);
  }, [activeCategory]);

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    /* ── Full viewport layout ── */
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#2563eb,#4338ca)", color: "#fff", padding: "12px 20px", flexShrink: 0 }}>
        {/* Row 1 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
              <FaMapMarkerAlt style={{ color: "#93c5fd" }} />
              Nearby Services
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#bfdbfe" }}>
              {userLocation
                ? `📍 ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}  ·  ${filteredServices.length} result${filteredServices.length !== 1 ? "s" : ""} found`
                : "Detecting your location..."}
            </p>
          </div>

          {/* Search + relocate */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "10px", padding: "6px 12px", gap: "6px" }}>
              <FaSearch style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                style={{ background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: "13px", width: "140px" }}
              />
            </div>
            <button
              onClick={getLocation}
              title="Use my location"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "10px", padding: "8px 10px", cursor: "pointer", color: "#fff" }}
            >
              {locLoading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaLocationArrow />}
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              style={{
                flexShrink: 0,
                display: "flex", alignItems: "center", gap: "5px",
                fontSize: "12px", fontWeight: 600,
                padding: "5px 12px", borderRadius: "20px",
                border: activeCategory === cat.key ? "2px solid white" : "1px solid rgba(255,255,255,0.3)",
                background: activeCategory === cat.key ? "#fff" : "rgba(255,255,255,0.1)",
                color: activeCategory === cat.key ? "#2563eb" : "#fff",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: "11px" }}>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main split: list | map ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT: scrollable list */}
        <div style={{ width: "380px", minWidth: "320px", overflowY: "auto", background: "#f9fafb", borderRight: "1px solid #e5e7eb", padding: "12px" }}>

          {/* Location prompt */}
          {!locationGranted && !locLoading && !error && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px", textAlign: "center", padding: "32px" }}>
              <div style={{ width: "72px", height: "72px", background: "#eff6ff", border: "4px solid #bfdbfe", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FaLocationArrow style={{ color: "#3b82f6", fontSize: "28px" }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: "16px", color: "#1f2937", margin: "0 0 4px" }}>Allow Location Access</p>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>We'll show real services near you — like Google Maps</p>
              </div>
              <button
                onClick={getLocation}
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 24px", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 14px rgba(59,130,246,0.4)" }}
              >
                📍 Find Nearby Services
              </button>
            </div>
          )}

          {/* Loc loading */}
          {locLoading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "12px", color: "#6b7280" }}>
              <FaSpinner style={{ fontSize: "32px", color: "#3b82f6", animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: "13px" }}>Getting your location...</p>
            </div>
          )}

          {/* Services loading */}
          {locationGranted && loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "12px", color: "#6b7280" }}>
              <FaSpinner style={{ fontSize: "28px", color: "#3b82f6", animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: "13px" }}>Searching real services nearby...</p>
            </div>
          )}

          {/* Error */}
          {error && !locLoading && (
            <div style={{ display: "flex", gap: "10px", background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "12px", padding: "12px 14px", fontSize: "13px", marginBottom: "12px" }}>
              <FaExclamationTriangle style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <p style={{ margin: "0 0 6px" }}>{error}</p>
                <button onClick={getLocation} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", textDecoration: "underline", fontSize: "12px", padding: 0 }}>
                  🔄 Try Again
                </button>
              </div>
            </div>
          )}

          {/* Service cards */}
          {!loading && filteredServices.map((svc, i) => (
            <div
              key={i}
              onClick={() => { setMapCenter(svc.position); setSelectedService(svc); }}
              style={{
                marginBottom: "10px", cursor: "pointer",
                outline: selectedService?.name === svc.name ? "2px solid #3b82f6" : "none",
                borderRadius: "16px",
              }}
            >
              <ServiceCard
                title={svc.name}
                type={svc.type}
                rating={svc.rating}
                distance={svc.distance}
                phone={svc.phone}
                address={svc.address}
                opening_hours={svc.opening_hours}
                website={svc.website}
              />
            </div>
          ))}

          {/* Empty state */}
          {!loading && locationGranted && filteredServices.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af" }}>
              <p style={{ fontSize: "40px" }}>🔍</p>
              <p style={{ fontWeight: 600, color: "#6b7280" }}>Nothing found nearby</p>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>Try a different category</p>
              <button onClick={() => fetchServices(userLocation.lat, userLocation.lng, activeCategory)} style={{ marginTop: "12px", color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}>
                🔄 Retry
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Map — takes remaining space */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapComponent
            services={filteredServices}
            selectedPosition={mapCenter || (userLocation ? [userLocation.lat, userLocation.lng] : [23.0225, 72.5714])}
            userLocation={userLocation ? [userLocation.lat, userLocation.lng] : null}
            selectedService={selectedService}
          />
        </div>
      </div>

      {/* spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
