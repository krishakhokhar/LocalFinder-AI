 import { useState, useRef, useEffect } from "react";
import { FaRobot, FaTimes } from "react-icons/fa";
import { API_BASE_URL } from "../config/api";

export default function Chatbox({ setSelectedPosition }) {
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

  // 🔥 SEND MESSAGE
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: "user" };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input }),
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
          className="fixed bottom-5 right-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-full shadow-xl hover:scale-110 transition z-[9999]"
        >
          <FaRobot size={22} />
        </button>
      )}

      {/* 💬 Chatbox */}
      {open && (
        <div className="fixed bottom-5 right-5 w-80 bg-white shadow-2xl rounded-3xl overflow-hidden z-[9999]">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-3 flex justify-between">
            <div className="flex items-center gap-2">
              <FaRobot /> AI Assistant
            </div>
            <FaTimes
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            />
          </div>

          {/* Messages */}
          <div className="h-64 overflow-y-auto p-3 space-y-2 bg-gray-100">
            {messages.map((msg, index) => (
              <div key={index}>
                
                {/* TEXT */}
                <div
                  className={`p-2 rounded-xl max-w-[70%] text-sm ${
                    msg.sender === "user"
                      ? "bg-blue-500 text-white ml-auto"
                      : "bg-gray-300 text-black"
                  }`}
                >
                  {msg.text}
                </div>

                {/* 🔥 SERVICES CARDS */}
                {msg.services && msg.services.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.services.map((s, i) => (
                      <div
                        key={i}
                        className="bg-white p-2 rounded-lg shadow text-xs hover:shadow-md transition"
                      >
                        <div className="font-semibold">{s.name}</div>
                        <div>⭐ {s.rating}</div>
                        <div>📍 {s.distance}</div>
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
          <div className="flex border-t">
            <input
              type="text"
              placeholder="Ask something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 p-2 outline-none text-sm"
            />
            <button
              onClick={handleSend}
              className="bg-blue-500 text-white px-4 hover:bg-blue-600"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}