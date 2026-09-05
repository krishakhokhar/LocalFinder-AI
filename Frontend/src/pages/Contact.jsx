import { useState } from "react";
import { FaUser, FaEnvelope, FaCommentDots } from "react-icons/fa";
import { API_BASE_URL } from "../config/api";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !message) {
      setError("All fields are required");
      return;
    }

    if (!email.includes("@")) {
      setError("Invalid email");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(data.message || "Message Sent Successfully ✅");
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setError(data.message || "Something went wrong. Please try again.");
      }
    } catch (err) {
      setError("Server error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center relative px-4"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df')",
      }}
    >
      <div className="absolute inset-0 bg-black/60"></div>

      <div className="relative z-10 bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md text-white animate-fadeUp">
        
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">
          Contact Us
        </h1>

        <p className="text-center mb-6 opacity-90">
          Get in touch with us anytime
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          
          <div className="flex items-center bg-white/20 p-3 rounded-lg">
            <FaUser className="mr-2" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="bg-transparent outline-none w-full placeholder-white"
            />
          </div>

          <div className="flex items-center bg-white/20 p-3 rounded-lg">
            <FaEnvelope className="mr-2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your Email"
              className="bg-transparent outline-none w-full placeholder-white"
            />
          </div>

          <div className="flex items-start bg-white/20 p-3 rounded-lg">
            <FaCommentDots className="mr-2 mt-1" />
            <textarea
              rows="4"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your Message"
              className="bg-transparent outline-none w-full placeholder-white"
            ></textarea>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {success && <p className="text-green-400 text-sm text-center">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 py-3 rounded-lg hover:bg-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </div>
  );
}