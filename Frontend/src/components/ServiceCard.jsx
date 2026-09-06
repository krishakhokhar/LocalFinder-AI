import {
  FaStar, FaPhone, FaMapMarkerAlt, FaCut, FaTools, FaBolt,
  FaUtensils, FaSpa, FaDumbbell, FaCar, FaStore, FaGlobe, FaClock, FaDirections, FaTrashAlt
} from "react-icons/fa";

const TYPE_CONFIG = {
  salon:        { icon: <FaCut />,     color: "bg-pink-100 text-pink-600",    bar: "#ec4899" },
  hairdresser:  { icon: <FaCut />,     color: "bg-pink-100 text-pink-600",    bar: "#ec4899" },
  plumber:      { icon: <FaTools />,   color: "bg-yellow-100 text-yellow-700",bar: "#eab308" },
  electrician:  { icon: <FaBolt />,    color: "bg-blue-100 text-blue-600",    bar: "#3b82f6" },
  restaurant:   { icon: <FaUtensils />,color: "bg-orange-100 text-orange-600",bar: "#f97316" },
  cafe:         { icon: <FaUtensils />,color: "bg-orange-100 text-orange-600",bar: "#f97316" },
  fast_food:    { icon: <FaUtensils />,color: "bg-orange-100 text-orange-600",bar: "#f97316" },
  spa:          { icon: <FaSpa />,     color: "bg-purple-100 text-purple-600",bar: "#a855f7" },
  fitness_centre:{ icon: <FaDumbbell />, color: "bg-purple-100 text-purple-600", bar: "#a855f7" },
  car:          { icon: <FaCar />,     color: "bg-green-100 text-green-600",  bar: "#22c55e" },
  car_repair:   { icon: <FaCar />,     color: "bg-green-100 text-green-600",  bar: "#22c55e" },
};

function getConfig(type) {
  return TYPE_CONFIG[type] || { icon: <FaStore />, color: "bg-gray-100 text-gray-600", bar: "#6366f1" };
}

export default function ServiceCard({
  title, type, rating, distance, phone, address, opening_hours, website,
  lat, lng, userLat, userLng,
  isFavorite, onToggleFavorite, onRemoveFavorite,
}) {
  const cfg = getConfig(type);
  const typeLabel = type ? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Service";

  // Directions must point at this service's own exact coordinates - a
  // name-only Google Maps search can resolve to the wrong branch/location
  // for common business names, sometimes kilometers away. Falls back to a
  // name search only in the rare case no coordinates were provided at all.
  const openDirections = () => {
    if (typeof lat !== "number" || typeof lng !== "number") {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(title)}`, "_blank");
      return;
    }
    const params = new URLSearchParams({ api: "1", destination: `${lat},${lng}` });
    if (typeof userLat === "number" && typeof userLng === "number") {
      params.set("origin", `${userLat},${userLng}`);
    }
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden transition-all duration-200 group relative">
      {/* Colored top bar */}
      <div style={{ height: "3px", background: cfg.bar }} />

      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          title={isFavorite ? "Remove from favorites" : "Save to favorites"}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 shadow-sm hover:scale-110 transition text-base z-10"
        >
          {isFavorite ? "❤️" : "🤍"}
        </button>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3 pr-8">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ${cfg.color}`}>
            {cfg.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-800 leading-snug group-hover:text-blue-600 transition truncate">
              {title}
            </h2>
            <span className="text-xs text-gray-400">{typeLabel}</span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            <FaStar className="text-yellow-400" />
            <span className="font-semibold text-gray-700">{rating}</span>
          </span>
          {distance && (
            <>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1">
                <FaMapMarkerAlt className="text-blue-400" />
                {distance}
              </span>
            </>
          )}
          {opening_hours && (
            <>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1 truncate max-w-[100px]" title={opening_hours}>
                <FaClock className="text-green-400 flex-shrink-0" />
                <span className="truncate">{opening_hours}</span>
              </span>
            </>
          )}
        </div>

        {/* Address */}
        {address && (
          <p className="text-xs text-gray-400 mb-3 flex items-start gap-1">
            <FaMapMarkerAlt className="text-gray-300 mt-0.5 flex-shrink-0" />
            <span className="truncate">{address}</span>
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-xs font-semibold transition"
            >
              <FaPhone size={10} /> Call
            </a>
          ) : (
            <button
              onClick={() => alert("Phone number not available")}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-200 text-gray-400 py-2 rounded-xl text-xs font-semibold cursor-not-allowed"
            >
              <FaPhone size={10} /> No Phone
            </button>
          )}

          <button
            onClick={openDirections}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl text-xs font-semibold transition"
          >
            <FaDirections size={10} /> Directions
          </button>

          {website && (
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 px-3 py-2 rounded-xl text-xs font-semibold transition"
            >
              <FaGlobe size={10} />
            </a>
          )}
        </div>

        {onRemoveFavorite && (
          <button
            onClick={onRemoveFavorite}
            className="w-full mt-2 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-500 py-2 rounded-xl text-xs font-semibold transition"
          >
            <FaTrashAlt size={10} /> Remove Favorite
          </button>
        )}
      </div>
    </div>
  );
}
