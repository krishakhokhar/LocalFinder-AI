import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  Building2,
  CalendarCheck,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Mail,
  Map,
  MapPin,
  Menu,
  Shield,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import useMotionSafe from "../../hooks/useMotionSafe";
import { EASE_OUT } from "../../utils/motion";
import Button from "../common/Button";
import Avatar from "../common/Avatar";
import AVAILABLE_ROUTES from "../../config/routes";

const NAV_LINKS = [
  { to: "/", label: "Home", icon: MapPin, end: true },
  { to: "/explore", label: "Explore", icon: Map },
  { to: "/contact", label: "Contact", icon: Mail },
];


/**
 * Sticky top navigation.
 *
 * Becomes opaque with a subtle blur once the page scrolls, so content
 * never bleeds through it while staying light at the top of the page. The
 * account menu is driven by AuthContext, which means signing out updates
 * it immediately instead of needing a page reload.
 */
export default function Navbar({ unreadCount = 0 }) {
  const { user, isAuthenticated, isOwner, isAdmin, signOut } = useAuth();
  const { reduce } = useMotionSafe();
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close both menus whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  // Click-outside and Escape for the account dropdown.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleSignOut = () => {
    signOut();
    setMenuOpen(false);
    setMobileOpen(false);
    navigate("/");
  };

  // Entries are added here as each area of the product ships, so the menu
  // never offers a link to a page that does not exist yet.
  const accountLinks = [
    { to: "/favorites", label: "Saved places", icon: Heart },
    { to: "/bookings", label: "My bookings", icon: CalendarCheck },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    ...(isOwner ? [{ to: "/owner", label: "Business dashboard", icon: Building2 }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
    { to: "/account", label: "Account settings", icon: User },
  ].filter((item) => AVAILABLE_ROUTES.has(item.to));

  return (
    // Settles down from above on first paint. `y` only - animating height
    // or padding here would reflow every page under it.
    <motion.header
      initial={reduce ? false : { y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT }}
      className={`sticky top-0 z-[900] border-b transition-all duration-300 ${
        scrolled
          ? "border-line bg-surface/85 shadow-soft backdrop-blur-xl"
          : "border-transparent bg-surface/60 backdrop-blur-sm"
      }`}
    >
      <nav className="lf-container flex h-16 items-center justify-between gap-4" aria-label="Main">
        {/* Brand */}
        <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="LocalFinder home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-soft transition-transform duration-300 group-hover:scale-105">
            <MapPin className="h-[18px] w-[18px] text-white" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">
            Local<span className="text-brand-600">Finder</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `relative rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isActive ? "text-brand-700" : "text-ink-muted hover:bg-slate-100 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  {isActive ? (
                    <motion.span
                      layoutId={reduce ? undefined : "nav-active"}
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-600"
                    />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Account / auth */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {AVAILABLE_ROUTES.has("/notifications") ? (
                <Link
                  to="/notifications"
                  className="relative hidden rounded-lg p-2 text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink md:inline-flex"
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                >
                  <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}

              <div className="relative hidden md:block" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-1.5 rounded-xl border border-line bg-surface py-1 pl-1 pr-2 transition-colors hover:border-line-strong"
                >
                  <Avatar name={user?.name} email={user?.email} src={user?.avatarUrl} size="xs" />
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-ink-faint transition-transform ${menuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {menuOpen ? (
                    <motion.div
                      role="menu"
                      initial={reduce ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduce ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 mt-2 w-64 overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-lift"
                    >
                      <div className="flex items-center gap-3 border-b border-line px-2.5 pb-3 pt-2">
                        <Avatar name={user?.name} email={user?.email} src={user?.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
                          <p className="truncate text-xs text-ink-muted" title={user?.email}>
                            {user?.email}
                          </p>
                        </div>
                      </div>

                      <div className="py-1">
                        {accountLinks.map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            role="menuitem"
                            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-slate-50"
                          >
                            <item.icon className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                            <span className="flex-1">{item.label}</span>
                            {item.badge > 0 ? (
                              <span className="rounded-full bg-danger-500 px-1.5 text-[10px] font-bold text-white">
                                {item.badge > 9 ? "9+" : item.badge}
                              </span>
                            ) : null}
                          </Link>
                        ))}
                      </div>

                      <div className="border-t border-line pt-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-danger-600 transition-colors hover:bg-danger-50"
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button to="/auth" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button to="/auth?mode=register&role=owner" size="sm" icon={Building2}>
                List your business
              </Button>
            </div>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={reduce ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 1 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-line bg-surface md:hidden"
          >
            <div className="lf-container space-y-1 py-3">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-slate-50"
                    }`
                  }
                >
                  <link.icon className="h-4 w-4" aria-hidden="true" />
                  {link.label}
                </NavLink>
              ))}

              <div className="my-2 h-px bg-line" />

              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <Avatar name={user?.name} email={user?.email} src={user?.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
                      <p className="truncate text-xs text-ink-muted">{user?.email}</p>
                    </div>
                  </div>
                  {accountLinks.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-slate-50"
                    >
                      <item.icon className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge > 0 ? (
                        <span className="rounded-full bg-danger-500 px-1.5 text-[10px] font-bold text-white">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger-600 transition-colors hover:bg-danger-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </button>
                </>
              ) : (
                <div className="space-y-2 px-1 pb-1 pt-1">
                  <Button to="/auth" variant="outline" fullWidth>
                    Sign in
                  </Button>
                  <Button to="/auth?mode=register&role=owner" fullWidth icon={LayoutDashboard}>
                    List your business
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
