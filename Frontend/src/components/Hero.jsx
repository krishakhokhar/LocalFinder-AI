import { useNavigate } from "react-router-dom";
import {
  FaSearchLocation,
  FaCut,
  FaTools,
  FaBolt,
  FaUtensils,
  FaSpa,
  FaCar,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { useState } from "react";

const categories = [
  { icon: <FaCut />, label: "Salon", type: "salon", color: "bg-pink-500" },
  { icon: <FaTools />, label: "Plumber", type: "plumber", color: "bg-yellow-500" },
  { icon: <FaBolt />, label: "Electrician", type: "electrician", color: "bg-blue-500" },
  { icon: <FaUtensils />, label: "Restaurant", type: "restaurant", color: "bg-orange-500" },
  { icon: <FaSpa />, label: "Spa", type: "spa", color: "bg-purple-500" },
  { icon: <FaCar />, label: "Car Service", type: "car", color: "bg-green-500" },
];

export default function Hero() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const handleSearch = () => {
    if (search.trim()) {
      navigate(`/services?type=${search.trim().toLowerCase()}`);
    } else {
      navigate("/services");
    }
  };

  return (
    <div className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />

      <div className="relative z-10 text-center text-white px-6 w-full max-w-3xl mx-auto animate-fadeUp">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm px-4 py-2 rounded-full mb-5 font-medium">
          <FaMapMarkerAlt className="text-blue-400" />
          Location-Based Service Discovery
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold mb-3 leading-tight">
          Find{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Nearby Services
          </span>
          <br />
          Instantly
        </h1>

        <p className="text-gray-300 text-base md:text-lg mb-8 max-w-lg mx-auto">
          Discover the best local services around you — powered by your real-time location
        </p>

        <div className="flex justify-center mb-8">
          <div className="flex w-full max-w-md shadow-2xl rounded-xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/20">
            <div className="flex items-center px-3 text-gray-300">
              <FaSearchLocation size={16} />
            </div>
            <input
              type="text"
              placeholder="Search salon, plumber, electrician..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 py-3 px-2 bg-transparent text-white placeholder-gray-400 outline-none text-sm"
            />
            <button
              onClick={handleSearch}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-3 text-white font-semibold hover:opacity-90 transition text-sm"
            >
              Search
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((cat) => (
            <button
              key={cat.type}
              onClick={() => navigate(`/services?type=${cat.type}`)}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm px-4 py-2 rounded-full hover:bg-white/20 hover:scale-105 transition-all duration-200 font-medium"
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
