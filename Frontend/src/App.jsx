import { Suspense, lazy, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider } from "./context/AuthContext";
import ScrollToTop from "./components/motion/ScrollToTop";
import ProtectedRoute from "./components/common/ProtectedRoute";
import RouteFallback from "./components/common/RouteFallback";
import AiAssistant from "./components/ai/AiAssistant";

// The landing page is the one route that must paint immediately, so it
// stays in the initial bundle. Everything else is split: Leaflet, the
// charts and the whole admin area are large, and most visitors never
// reach them.
import Home from "./pages/Home";

const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const BusinessDetails = lazy(() => import("./pages/BusinessDetails"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Account = lazy(() => import("./pages/Account"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));

const OwnerDashboard = lazy(() => import("./pages/owner/OwnerDashboard"));
const BusinessForm = lazy(() => import("./pages/owner/BusinessForm"));
const OwnerBookings = lazy(() => import("./pages/owner/OwnerBookings"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminBusinesses = lazy(() => import("./pages/admin/AdminBusinesses"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminContacts = lazy(() => import("./pages/admin/AdminContacts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));

/** Shorthand for the repeated guard wrapper. */
function Guarded({ roles, children }) {
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
}

/**
 * Routes, with an exit animation between them.
 *
 * AnimatePresence needs the location of the *outgoing* page, which is
 * why the routing table lives in its own component below BrowserRouter
 * rather than inline in App.
 */
function AppRoutes({ selectedPosition, setUserLocation }) {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteFallback />}>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />

          <Route
            path="/explore"
            element={
              <ServicesPage selectedPosition={selectedPosition} onLocationChange={setUserLocation} />
            }
          />
          {/* The original path, kept so existing links and bookmarks work. */}
          <Route path="/services" element={<Navigate to="/explore" replace />} />

          <Route path="/business/:id" element={<BusinessDetails />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth" element={<Auth />} />

          <Route
            path="/favorites"
            element={
              <Guarded>
                <Favorites />
              </Guarded>
            }
          />
          <Route
            path="/account"
            element={
              <Guarded>
                <Account />
              </Guarded>
            }
          />
          <Route
            path="/bookings"
            element={
              <Guarded>
                <MyBookings />
              </Guarded>
            }
          />
          <Route
            path="/notifications"
            element={
              <Guarded>
                <Notifications />
              </Guarded>
            }
          />

          <Route
            path="/owner"
            element={
              <Guarded roles={["owner", "admin"]}>
                <OwnerDashboard />
              </Guarded>
            }
          />
          <Route
            path="/owner/bookings"
            element={
              <Guarded roles={["owner", "admin"]}>
                <OwnerBookings />
              </Guarded>
            }
          />
          <Route
            path="/owner/businesses/:id"
            element={
              <Guarded roles={["owner", "admin"]}>
                <BusinessForm />
              </Guarded>
            }
          />

          <Route
            path="/admin"
            element={
              <Guarded roles={["admin"]}>
                <AdminDashboard />
              </Guarded>
            }
          />
          <Route
            path="/admin/businesses"
            element={
              <Guarded roles={["admin"]}>
                <AdminBusinesses />
              </Guarded>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Guarded roles={["admin"]}>
                <AdminUsers />
              </Guarded>
            }
          />
          <Route
            path="/admin/reviews"
            element={
              <Guarded roles={["admin"]}>
                <AdminReviews />
              </Guarded>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <Guarded roles={["admin"]}>
                <AdminReports />
              </Guarded>
            }
          />
          <Route
            path="/admin/contacts"
            element={
              <Guarded roles={["admin"]}>
                <AdminContacts />
              </Guarded>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <Guarded roles={["admin"]}>
                <AdminCategories />
              </Guarded>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

export default function App() {
  // The AI assistant can move the Explore map, and reuses whatever
  // location Explore has already resolved so it never asks twice.
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AppRoutes selectedPosition={selectedPosition} setUserLocation={setUserLocation} />
        <AiAssistant setSelectedPosition={setSelectedPosition} userLocation={userLocation} />
        <ToastContainer
          position="bottom-right"
          autoClose={3500}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable
          theme="light"
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
