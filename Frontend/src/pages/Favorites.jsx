import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import ServiceCard from "../components/ServiceCard";
import { useFavorites } from "../hooks/useFavorites";
import { FaSpinner } from "react-icons/fa";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
}

export default function Favorites() {
  const navigate = useNavigate();
  const { favorites, loaded, isLoggedIn, removeFavorite } = useFavorites();
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/auth");
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-1">
          ❤️ My Favorite Places
        </h1>
        <p className="text-gray-500 text-sm mb-8">Places you've saved for later</p>

        {!loaded ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <FaSpinner className="animate-spin text-3xl mb-3" />
            Loading your favorites...
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 gap-3 animate-fadeUp">
            <p className="text-5xl mb-2">💔</p>
            <p className="text-lg font-bold text-gray-700">No favorites yet</p>
            <p className="text-sm text-gray-500 max-w-xs">
              Save places you want to visit later.
            </p>
            <Link to="/services">
              <button className="mt-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 hover:scale-105 transition-all shadow-md">
                Explore Nearby Services
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((fav) => (
              <ServiceCard
                key={fav._id}
                title={fav.name}
                type={fav.category}
                rating={fav.rating}
                distance={
                  userLocation
                    ? haversine(userLocation.lat, userLocation.lng, fav.lat, fav.lng) + " km"
                    : null
                }
                phone={fav.phone}
                address={fav.address}
                opening_hours={fav.opening_hours}
                onRemoveFavorite={() => removeFavorite(fav._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
