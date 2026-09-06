import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaHome,
  FaServicestack,
  FaPhoneAlt,
  FaBars,
  FaTimes,
  FaMapMarkerAlt,
} from "react-icons/fa";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(false);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) setUser(storedUser);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white shadow-md" : "bg-white/90 backdrop-blur-md shadow-sm"} px-6 py-3`}>
      <div className="max-w-6xl mx-auto flex justify-between items-center">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <FaMapMarkerAlt className="text-white text-sm" />
          </div>
          <h1 className="text-lg font-extrabold text-gray-800">
            Local<span className="text-blue-500">Finder</span>
          </h1>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6 font-medium text-sm">
          {[
            { to: "/", label: "Home", icon: <FaHome /> },
            { to: "/services", label: "Services", icon: <FaServicestack /> },
            { to: "/contact", label: "Contact", icon: <FaPhoneAlt /> },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-1.5 transition-all duration-200 ${
                isActive(item.to)
                  ? "text-blue-600 font-semibold"
                  : "text-gray-600 hover:text-blue-500"
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
              {isActive(item.to) && (
                <span className="block h-0.5 w-full bg-blue-500 absolute bottom-0 left-0 rounded-full" />
              )}
            </Link>
          ))}
        </div>

        {/* Login / Avatar */}
        <div className="hidden md:block relative">
          {user ? (
            <div>
              <div
                onClick={() => setOpenDropdown(!openDropdown)}
                className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full cursor-pointer font-bold text-sm hover:scale-105 transition"
              >
                {user.email?.charAt(0).toUpperCase()}
              </div>
              {openDropdown && (
                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white shadow-xl rounded-2xl p-2 border border-gray-100 animate-fadeUp overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 mb-1">
                    <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full font-bold text-sm">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate" title={user.email}>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/favorites"
                    onClick={() => setOpenDropdown(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition"
                  >
                    <span>❤️</span> My Favorites
                  </Link>

                  <div className="border-t border-gray-100 my-1"></div>

                  <button
                    onClick={() => {
                      localStorage.removeItem("token");
                      localStorage.removeItem("user");
                      window.location.reload();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-500 rounded-lg transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/auth">
              <button className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 hover:scale-105 transition-all">
                Login
              </button>
            </Link>
          )}
        </div>

        {/* Mobile Burger */}
        <button
          className="md:hidden text-gray-700 text-xl"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden mt-3 bg-white border border-gray-100 shadow-xl rounded-2xl p-5 space-y-3 animate-fadeUp">
          {[
            { to: "/", label: "Home", icon: <FaHome /> },
            { to: "/services", label: "Services", icon: <FaServicestack /> },
            { to: "/contact", label: "Contact", icon: <FaPhoneAlt /> },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg transition ${
                isActive(item.to)
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                to="/favorites"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                <span>❤️</span> My Favorites
              </Link>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  window.location.reload();
                }}
                className="w-full bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/auth" onClick={() => setIsOpen(false)}>
              <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold">
                Login
              </button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
