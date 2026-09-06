 import { useState, useRef, useEffect } from "react";
import { FaRobot, FaTimes } from "react-icons/fa";
import { API_BASE_URL } from "../config/api";

export default function Chatbox({ setSelectedPosition, userLocation }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi! I am your AI assistant 🤖", sender: "bot" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);

  // 🔥 Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Prefer the location the Services page already detected (shared via
  // App.jsx) so the assistant never has to ask for it again. Only falls
  // back to a fresh browser request if the user opens chat without
  // having visited Services first.
  const getLocation = () => {
    if (userLocation) return Promise.resolve(userLocation);
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 5 * 60 * 1000 }
      );
    });
  };

  // 🔥 SEND MESSAGE
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: "user" };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const location = await getLocation();
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input, ...location }),
      });

      const data = await res.json();

      const botMessage = {
        text: data.reply || "Sorry, something went wrong. Please try again.",
        sender: "bot",
        services: data.services || [],
      };

      setMessages((prev) => [...prev, botMessage]);

      // 🔥 MAP MOVE
      if (data.services && data.services.length > 0) {
        setSelectedPosition(data.services[0].position);
      }

    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { text: "Server error ❌", sender: "bot" },
      ]);
    }

    setLoading(false);
  };

  return (
    <>
      {/* 🤖 Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-full shadow-xl hover:scale-110 transition-transform duration-200 z-[9999]"
        >
          <FaRobot size={22} />
        </button>
      )}

      {/* 💬 Chatbox */}
      {open && (
        <div className="fixed bottom-5 right-5 left-5 sm:left-auto w-auto sm:w-80 bg-white shadow-2xl rounded-3xl overflow-hidden z-[9999] animate-fadeUp">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 flex justify-between items-center">
            <div className="flex items-center gap-2.5 font-semibold">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaRobot size={14} />
              </div>
              AI Assistant
            </div>
            <FaTimes
              onClick={() => setOpen(false)}
              className="cursor-pointer hover:opacity-75 transition"
            />
          </div>

          {/* Messages */}
          <div className="h-64 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.map((msg, index) => (
              <div key={index}>
                
                {/* TEXT */}
                <div
                  className={`p-2.5 rounded-2xl max-w-[80%] text-sm leading-snug shadow-sm ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white ml-auto rounded-br-sm"
                      : "bg-white text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>

                {/* 🔥 SERVICES CARDS */}
                {msg.services && msg.services.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {msg.services.map((s, i) => (
                      <div
                        key={i}
                        className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 text-xs hover:shadow-md transition"
                      >
                        <div className="font-semibold text-gray-800">{s.name}</div>
                        <div className="flex items-center gap-2 text-gray-500 mt-0.5">
                          <span>⭐ {s.rating}</span>
                          <span>📍 {s.distance}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* 🔥 Loading */}
            {loading && (
              <div className="text-gray-500 text-sm animate-pulse">
                AI is typing...
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex border-t border-gray-100 bg-white">
            <input
              type="text"
              placeholder="Ask something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 p-3 outline-none text-sm placeholder-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}