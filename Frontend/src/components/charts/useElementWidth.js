import { useEffect, useRef, useState } from "react";

/**
 * Tracks a container's pixel width.
 *
 * Charts are drawn at real pixel dimensions rather than stretched with
 * `preserveAspectRatio`: scaling an SVG distorts stroke widths, so a 2px
 * line becomes 3.4px on a wide screen and the chart loses the even
 * weight the mark specs exist to produce.
 */
export function useElementWidth(fallback = 600) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => setWidth(Math.max(240, Math.round(element.clientWidth)));
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export default useElementWidth;
