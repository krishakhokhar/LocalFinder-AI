import { FaMapMarkerAlt, FaHeart, FaGithub } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <FaMapMarkerAlt className="text-white text-xs" />
          </div>
          <span className="font-bold text-sm">Local<span className="text-blue-400">Finder</span></span>
        </div>

        <p className="text-gray-400 text-xs flex items-center gap-1">
          Made with <FaHeart className="text-red-500 mx-1" /> for local service discovery
        </p>

        <p className="text-gray-500 text-xs">© 2025 LocalFinder. All rights reserved.</p>
      </div>
    </footer>
  );
}
