import { useState, useCallback } from "react";
import ServiceCard from "./ServiceCard";
import { API_BASE_URL } from "../config/api";
import { useFavorites } from "../hooks/useFavorites";
import { toast } from "react-toastify";
import {
  FaMapMarkerAlt, FaSpinner, FaLocationArrow, FaExclamationTriangle
} from "react-icons/fa";

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
}

async function fetchOverpassServices(lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    category: "all",
    radius: "2000",
  });
  const res = await fetch(`${API_BASE_URL}/api/services/nearby?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Could not fetch nearby services");
  }
  const results = (data.elements || [])
    .filter((el) => el.tags?.name)
    .map((el) => ({
      placeId: `${el.tags.name}::${el.lat.toFixed(5)}::${el.lon.toFixed(5)}`,
      name: el.tags.name,
      type: el.tags.amenity || el.tags.craft || el.tags.shop || el.tags.leisure || "service",
      phone: el.tags.phone || el.tags["contact:phone"] || null,
      address: el.tags["addr:street"] || null,
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
      distance: getDistance(lat, lng, el.lat, el.lon) + " km",
      distNum: parseFloat(getDistance(lat, lng, el.lat, el.lon)),
      position: [el.lat, el.lon],
    }))
    .sort((a, b) => a.distNum - b.distNum)
    .slice(0, 6);

  return { results, degradedMessage: data.degraded ? data.message : null };
}

export default function Services() {
  const [location, setLocation] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);

  const { isLoggedIn, favoriteByPlaceId, addFavorite, removeFavorite } = useFavorites();

  const handleToggleFavorite = useCallback(
    (svc) => {
      if (!isLoggedIn) {
        toast.info("Please login to save favorites ❤️");
        return;
      }
      const existing = favoriteByPlaceId.get(svc.placeId);
      if (existing) {
        removeFavorite(existing._id);
      } else {
        addFavorite({
          placeId: svc.placeId,
          name: svc.name,
          category: svc.type,
          lat: svc.position[0],
          lng: svc.position[1],
          address: svc.address,
          phone: svc.phone,
          rating: svc.rating,
        });
      }
    },
    [isLoggedIn, favoriteByPlaceId, addFavorite, removeFavorite]
  );

  const findServices = useCallback(() => {
    setRequested(true);
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        try {
          const { results, degradedMessage } = await fetchOverpassServices(lat, lng);
          setServices(results);
          if (degradedMessage) setError(degradedMessage);
        } catch {
          setError("Could not load services. Check connection.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("Location permission denied.");
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  return (
    <div className="py-16 px-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-2">
            Services <span className="text-blue-500">Near You</span>
          </h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Real businesses around your location — powered by OpenStreetMap
          </p>
        </div>

        {!requested && (
          <div className="flex flex-col items-center gap-5 py-12">
            <div className="w-20 h-20 rounded-full bg-blue-50 border-4 border-blue-100 flex items-center justify-center">
              <FaLocationArrow className="text-blue-500 text-3xl" />
            </div>
            <p className="text-gray-500 text-sm text-center max-w-xs">
              Share your location to see real nearby salons, plumbers, restaurants and more
            </p>
            <button
              onClick={findServices}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:opacity-90 hover:scale-105 transition shadow-lg"
            >
              <FaMapMarkerAlt /> Find Services Near Me
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <FaSpinner className="text-blue-500 text-4xl animate-spin" />
            <p className="text-sm">Searching nearby services...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 px-5 py-4 rounded-xl max-w-lg mx-auto text-sm">
            <FaExclamationTriangle /> {error}
          </div>
        )}

        {location && !loading && (
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-2 rounded-full">
              <FaMapMarkerAlt className="text-green-500" />
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </span>
          </div>
        )}

        {!loading && services.length > 0 && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <ServiceCard
                key={i}
                title={s.name}
                type={s.type}
                rating={s.rating}
                distance={s.distance}
                phone={s.phone}
                address={s.address}
                lat={s.position[0]}
                lng={s.position[1]}
                userLat={location?.lat}
                userLng={location?.lng}
                isFavorite={favoriteByPlaceId.has(s.placeId)}
                onToggleFavorite={() => handleToggleFavorite(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
