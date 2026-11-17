import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll position on navigation.
 *
 * React Router keeps the scroll offset between routes, which lands users
 * halfway down a page they have never seen. Hash links are left alone so
 * in-page anchors still work.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, [pathname, hash]);

  return null;
}
