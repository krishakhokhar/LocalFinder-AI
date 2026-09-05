import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";

import Home from "./pages/Home";
import ServicesPage from "./pages/ServicesPage";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import Chatbot from "./components/ChatBox";
import Footer from "./components/Footer";

function App() {
  // 🔥 GLOBAL STATE (map ke liye)
  const [selectedPosition, setSelectedPosition] = useState(null);

  return (
    <BrowserRouter>
      {/* 🔥 ROUTES */}
      <Routes>
        <Route path="/" element={<Home />} />

        {/* 👇 important: props pass */}
        <Route
          path="/services"
          element={
            <ServicesPage selectedPosition={selectedPosition} />
          }
        />

        <Route path="/contact" element={<Contact />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>

      {/* 🤖 Chatbot (map control karega) */}
      <Chatbot setSelectedPosition={setSelectedPosition} />
      <Footer />
    </BrowserRouter>
  );
}

export default App;