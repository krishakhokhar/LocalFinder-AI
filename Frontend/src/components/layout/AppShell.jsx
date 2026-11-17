import Navbar from "./Navbar";
import Footer from "./Footer";
import useNotifications from "../../hooks/useNotifications";

/**
 * Standard page frame: navbar, page content, footer, all in a column so
 * the footer sits at the bottom even on short pages.
 *
 * `fullHeight` is for the Explore view, which manages its own scrolling
 * area and must not grow the document.
 */
export default function AppShell({ children, footer = true, fullHeight = false }) {
  // Every page frame carries the badge, so the count is live wherever
  // the user happens to be.
  const { unread } = useNotifications();

  return (
    <div className={`flex flex-col ${fullHeight ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"}`}>
      <Navbar unreadCount={unread} />
      <main className={`flex-1 ${fullHeight ? "min-h-0 overflow-hidden" : ""}`}>{children}</main>
      {footer ? <Footer /> : null}
    </div>
  );
}
