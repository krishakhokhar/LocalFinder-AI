import { useEffect, useRef } from "react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { WORLD_W, WORLD_H, isLand } from "./worldMask";

/**
 * A dot-matrix world map with signals arcing between real cities.
 *
 * Written from scratch rather than copied from any paid component. The
 * land shape comes from Natural Earth 110m polygons, rasterised offline
 * into a 4KB bitmask (see worldMask.js) so nothing is fetched or decoded
 * at runtime.
 *
 * Cost control, because a second canvas already runs the hero headline:
 *
 *  - The dot map never changes, so it is drawn once into an offscreen
 *    canvas and blitted with a single drawImage each frame.
 *  - At most a few signals exist at a time, each a short quadratic arc.
 *  - The loop stops when the hero scrolls away or the tab is hidden.
 *  - Reduced motion paints the map once and starts no loop at all.
 */

const MAX_SIGNALS = 3;
const SPAWN_MS = 1400;

/**
 * Real cities, used as signal endpoints. Weighted towards India because
 * that is where this product's users are; the rest give the arcs somewhere
 * to travel. Coordinates are genuine - nothing here is invented.
 */
const CITIES = [
  { name: "Surat", lat: 21.17, lng: 72.83 },
  { name: "Mumbai", lat: 19.08, lng: 72.88 },
  { name: "Delhi", lat: 28.61, lng: 77.21 },
  { name: "Bengaluru", lat: 12.97, lng: 77.59 },
  { name: "Kolkata", lat: 22.57, lng: 88.36 },
  { name: "Dubai", lat: 25.2, lng: 55.27 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "New York", lat: 40.71, lng: -74.01 },
  { name: "São Paulo", lat: -23.55, lng: -46.63 },
  { name: "Nairobi", lat: -1.29, lng: 36.82 },
  { name: "Sydney", lat: -33.87, lng: 151.21 },
  { name: "Tokyo", lat: 35.68, lng: 139.69 },
];

export default function SignalField({
  className = "",
  dotColor = "rgba(100,116,139,0.34)",
  accent = "#2563EB",
  /** Target dot spacing in CSS pixels. */
  spacing = 7,
}) {
  const { reduce } = useMotionSafe();
  const hostRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let raf = 0;
    let running = false;
    let disposed = false;
    let base = null;
    let signals = [];
    let lastSpawn = 0;
    let width = 0;
    let height = 0;
    let layout = null;

    /** Equirectangular: lon/lat -> canvas pixels, matching the dot grid. */
    const project = (lat, lng) => ({
      x: layout.left + ((lng + 180) / 360) * layout.mapW,
      y: layout.top + ((90 - lat) / 180) * layout.mapH,
    });

    const build = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fit the 2:1 map into the box, cropping rather than letterboxing so
      // the hero never shows empty bands above and below the continents.
      const scale = Math.max(width / WORLD_W, height / WORLD_H) * (spacing / 7);
      const cell = Math.max(3.2, scale * 0.0 + spacing);
      const mapW = WORLD_W * cell;
      const mapH = WORLD_H * cell;
      layout = {
        cell,
        mapW,
        mapH,
        left: (width - mapW) / 2,
        top: (height - mapH) / 2,
      };

      base = document.createElement("canvas");
      base.width = canvas.width;
      base.height = canvas.height;
      const bctx = base.getContext("2d");
      if (!bctx) return;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.fillStyle = dotColor;

      const radius = Math.max(0.8, cell * 0.22);
      for (let row = 0; row < WORLD_H; row += 1) {
        const y = layout.top + row * cell;
        if (y < -cell || y > height + cell) continue;
        for (let col = 0; col < WORLD_W; col += 1) {
          if (!isLand(col, row)) continue;
          const x = layout.left + col * cell;
          if (x < -cell || x > width + cell) continue;

          // Fade towards the edges so the map never competes with the
          // headline sitting on top of it.
          const fx = Math.min(x, width - x) / (width * 0.5);
          const fy = Math.min(y, height - y) / (height * 0.5);
          const falloff = Math.min(1, Math.max(0, Math.min(fx, fy)) * 1.6);
          if (falloff <= 0.05) continue;

          bctx.globalAlpha = falloff;
          bctx.beginPath();
          bctx.arc(x, y, radius, 0, Math.PI * 2);
          bctx.fill();
        }
      }
      bctx.globalAlpha = 1;
    };

    const spawn = () => {
      if (signals.length >= MAX_SIGNALS || !layout) return;
      const a = CITIES[Math.floor(Math.random() * CITIES.length)];
      const b = CITIES[Math.floor(Math.random() * CITIES.length)];
      if (a === b) return;
      const from = project(a.lat, a.lng);
      const to = project(b.lat, b.lng);
      if (Math.hypot(to.x - from.x, to.y - from.y) < width * 0.12) return;
      signals.push({ from, to, t: 0, speed: 0.5 + Math.random() * 0.4, ripple: -1 });
    };

    /** Quadratic arc bowed perpendicular to the chord, like a flight path. */
    const pointOn = (s, t) => {
      const dx = s.to.x - s.from.x;
      const dy = s.to.y - s.from.y;
      const length = Math.hypot(dx, dy) || 1;
      const cx = (s.from.x + s.to.x) / 2 - (dy / length) * length * 0.2;
      const cy = (s.from.y + s.to.y) / 2 + (dx / length) * length * 0.2;
      const inv = 1 - t;
      return {
        x: inv * inv * s.from.x + 2 * inv * t * cx + t * t * s.to.x,
        y: inv * inv * s.from.y + 2 * inv * t * cy + t * t * s.to.y,
      };
    };

    const paintBase = () => {
      ctx.clearRect(0, 0, width, height);
      if (base) ctx.drawImage(base, 0, 0, width, height);
    };

    const frame = (now) => {
      if (disposed) return;
      paintBase();

      if (now - lastSpawn > SPAWN_MS) {
        lastSpawn = now;
        spawn();
      }

      ctx.lineCap = "round";
      for (const s of signals) {
        s.t += 0.0042 * s.speed;

        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        const tail = Math.max(0, s.t - 0.26);
        for (let i = 0; i < 12; i += 1) {
          const a = tail + ((s.t - tail) * i) / 12;
          const b = tail + ((s.t - tail) * (i + 1)) / 12;
          if (a < 0 || b > 1) continue;
          const pa = pointOn(s, a);
          const pb = pointOn(s, b);
          ctx.globalAlpha = (i / 12) * 0.55;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }

        if (s.t <= 1) {
          const head = pointOn(s, s.t);
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.ripple < 0) {
          s.ripple = 0;
        }

        if (s.ripple >= 0) {
          s.ripple += 0.018;
          ctx.globalAlpha = Math.max(0, 0.5 * (1 - s.ripple));
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(s.to.x, s.to.y, 3 + s.ripple * 30, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      signals = signals.filter((s) => s.ripple < 1);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || disposed || reduce) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    build();
    if (reduce) paintBase();
    else start();

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 }
    );
    observer.observe(host);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    let resizeTimer = 0;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (disposed) return;
        signals = [];
        build();
        if (reduce) paintBase();
      }, 160);
    });
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      stop();
      clearTimeout(resizeTimer);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduce, dotColor, accent, spacing]);

  return (
    <div ref={hostRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
