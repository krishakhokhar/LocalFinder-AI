import { useState } from "react";
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom"; // ✅ ADD
import { API_BASE_URL } from "../config/api";

export default function Auth() {
  const navigate = useNavigate(); // ✅ ADD

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password || (!isLogin && (!name || !confirmPassword))) {
      return toast.error("All fields are required ❌");
    }

    if (!emailRegex.test(email)) {
      return toast.error("Invalid email format ❌");
    }

    if (!passwordRegex.test(password)) {
      return toast.error("Password must be 6+ chars with letter & number ❌");
    }

    if (!isLogin && password !== confirmPassword) {
      return toast.error("Passwords do not match ❌");
    }

    setLoading(true);

    try {
      const url = isLogin
        ? `${API_BASE_URL}/api/auth/login`
        : `${API_BASE_URL}/api/auth/register`;

      const bodyData = isLogin
        ? { email, password }
        : { name, email, password };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success !== false) {
        toast.success(data.message || "Success ✅");

        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        localStorage.setItem("user", JSON.stringify({ email }));

        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");

        // 🔥 ONLY THIS ADDED
        if (isLogin) {
          navigate("/"); // HOME PAGE
        }

        if (!isLogin) {
          setIsLogin(true);
        }
      } else {
        toast.error(data.message || "Something went wrong ❌");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Server error ❌");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative px-4"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b')",
      }}
    >
      <div className="absolute inset-0 bg-black/60"></div>

      <div className="relative z-10 w-full max-w-sm sm:max-w-md bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-2xl text-white animate-fadeUp">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6">
          {isLogin ? "Login" : "Register"}
        </h1>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="flex items-center bg-white/20 p-3 rounded-lg">
              <FaUser className="mr-2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="bg-transparent outline-none w-full placeholder-white"
              />
            </div>
          )}

          <div className="flex items-center bg-white/20 p-3 rounded-lg">
            <FaEnvelope className="mr-2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="bg-transparent outline-none w-full placeholder-white"
            />
          </div>

          <div className="flex items-center bg-white/20 p-3 rounded-lg relative">
            <FaLock className="mr-2" />

            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="bg-transparent outline-none w-full placeholder-white"
            />

            <span
              className="absolute right-3 cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEye /> : <FaEyeSlash />}
            </span>
          </div>

          {!isLogin && (
            <div className="flex items-center bg-white/20 p-3 rounded-lg relative">
              <FaLock className="mr-2" />

              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="bg-transparent outline-none w-full placeholder-white"
              />

              <span
                className="absolute right-3 cursor-pointer"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <FaEye /> : <FaEyeSlash />}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 py-3 rounded-lg hover:bg-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-400 ml-1 cursor-pointer"
          >
            {isLogin ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}
