import { useEffect, useRef, useState } from "react";
import useMotionSafe from "../../hooks/useMotionSafe";

/**
 * Text rendered as particles that gather into place and scatter away from
 * the pointer.
 *
 * How it stays honest about the things that usually go wrong with this
 * effect:
 *
 *  - The real text is always in the DOM. A hidden span holds it for screen
 *    readers and search engines, and a second, invisible copy drives the
 *    layout - so the canvas can never cause a layout shift and the heading
 *    still wraps responsively like ordinary text.
 *  - Particle count is capped. The sampling gap is derived from the glyph
 *    area, so a huge headline costs the same as a small one.
 *  - The loop stops when the element scrolls out of view, when the tab is
 *    hidden, and on unmount. Nothing keeps burning frames in the
 *    background.
 *  - With reduced motion, or on a narrow screen, it renders as plain text
 *    and never starts a canvas at all.
 */

// A 3.4rem headline across two lines covers a lot of glyph area. The old
// cap of 5200 forced the sampler to widen its gap until the text was a
// sparse dotted outline instead of solid type, so the cap is raised and
// particle size is tied to the gap below - that pairing is what keeps the
// letters looking filled at any size.
const MAX_PARTICLES = 13000;
const GATHER_MS = 1500;
const REPEL_RADIUS = 110;
const REPEL_STRENGTH = 38;

/** #rrggbb -> [r, g, b] */
function toRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * Colour for a particle based on how far across the headline it sits.
 *
 * A single flat colour made the headline read as grey stipple. Running a
 * ramp across the width keeps it unmistakably coloured while still being
 * dark enough to read as a heading.
 */
function makeRamp(stops) {
  const rgb = stops.map(toRgb);
  return (t) => {
    const clamped = Math.min(0.9999, Math.max(0, t));
    const scaled = clamped * (rgb.length - 1);
    const index = Math.floor(scaled);
    const frac = scaled - index;
    const a = rgb[index];
    const b = rgb[Math.min(rgb.length - 1, index + 1)];
    const channel = (i) => Math.round(a[i] + (b[i] - a[i]) * frac);
    return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
  };
}

function prefersPlainText(reduce) {
  if (reduce) return true;
  if (typeof window === "undefined") return true;
  // Phones gain little from this and pay for it in battery.
  return window.matchMedia("(max-width: 767px)").matches;
}

export default function ParticleText({
  text,
  className = "",
  /** Colours sampled left-to-right across the headline. */
  ramp = ["#0F172A", "#2563EB", "#7C3AED"],
  density = 3,
}) {
  const { reduce } = useMotionSafe();
  const hostRef = useRef(null);
  const measureRef = useRef(null);
  const canvasRef = useRef(null);
  const [plain, setPlain] = useState(() => prefersPlainText(reduce));

  useEffect(() => {
    setPlain(prefersPlainText(reduce));
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setPlain(prefersPlainText(reduce));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [reduce]);

  useEffect(() => {
    if (plain) return undefined;

    const host = hostRef.current;
    const measure = measureRef.current;
    const canvas = canvasRef.current;
    if (!host || !measure || !canvas) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const rampColor = makeRamp(ramp);

    let raf = 0;
    let particles = [];
    let running = false;
    let startedAt = 0;
    let disposed = false;
    const pointer = { x: -9999, y: -9999, active: false };

    /** Samples the glyphs and turns the opaque pixels into particle targets. */
    const build = () => {
      const rect = measure.getBoundingClientRect();
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      if (width < 4 || height < 4) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw the text once, offscreen, using the very font the invisible
      // span is using - so the particles match the real typography.
      const style = window.getComputedStyle(measure);
      const off = document.createElement("canvas");
      off.width = width;
      off.height = height;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;

      octx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      octx.textBaseline = "top";
      octx.fillStyle = "#000";

      // Mirror the span's line boxes so multi-line headings sample correctly.
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.1;
      const words = String(text).split(" ");
      const lines = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (octx.measureText(candidate).width > width && current) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) lines.push(current);

      const totalHeight = lines.length * lineHeight;
      const top = Math.max(0, (height - totalHeight) / 2);
      lines.forEach((line, index) => {
        const lineWidth = octx.measureText(line).width;
        const left = style.textAlign === "center" ? (width - lineWidth) / 2 : 0;
        octx.fillText(line, left, top + index * lineHeight);
      });

      const { data } = octx.getImageData(0, 0, width, height);

      // Choose the sampling gap so the particle count stays bounded no
      // matter how large the heading is rendered.
      let gap = Math.max(2, Math.round(density));
      let points = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        points = [];
        for (let y = 0; y < height; y += gap) {
          for (let x = 0; x < width; x += gap) {
            if (data[(y * width + x) * 4 + 3] > 128) points.push([x, y]);
          }
        }
        if (points.length <= MAX_PARTICLES) break;
        gap += 1;
      }

      // Each dot must be about as wide as the gap between samples, or the
      // glyphs read as dots rather than letters.
      const dot = Math.max(1.5, gap * 0.95);

      particles = points.map(([x, y]) => ({
        tx: x,
        ty: y,
        // Start scattered, then gather.
        x: x + (Math.random() - 0.5) * 220,
        y: y + (Math.random() - 0.5) * 160,
        seed: Math.random() * Math.PI * 2,
        // Colour runs across the headline, so the type is clearly coloured
        // rather than a flat monochrome stipple.
        tint: rampColor(x / Math.max(1, width)),
        size: dot * (0.88 + Math.random() * 0.24),
      }));
      startedAt = performance.now();
    };

    const frame = (now) => {
      if (disposed) return;
      const width = canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
      const height = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));
      ctx.clearRect(0, 0, width, height);

      const gather = Math.min(1, (now - startedAt) / GATHER_MS);
      // easeOutCubic
      const ease = 1 - (1 - gather) ** 3;

      for (const p of particles) {
        // Drift keeps the headline alive once it has settled.
        const driftX = Math.sin(now / 1400 + p.seed) * 0.6;
        const driftY = Math.cos(now / 1600 + p.seed) * 0.6;
        const homeX = p.tx + driftX;
        const homeY = p.ty + driftY;

        p.x += (homeX - p.x) * (0.08 + 0.12 * ease);
        p.y += (homeY - p.y) * (0.08 + 0.12 * ease);

        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < REPEL_RADIUS && distance > 0.01) {
            const push = (1 - distance / REPEL_RADIUS) * REPEL_STRENGTH;
            p.x += (dx / distance) * push * 0.25;
            p.y += (dy / distance) * push * 0.25;
          }
        }

        ctx.fillStyle = p.tint;
        // Fully opaque once gathered - the old formula topped out below 1
        // and left the headline looking washed out.
        ctx.globalAlpha = 0.25 + 0.75 * ease;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || disposed) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    // Fonts must be ready or the glyphs get sampled in a fallback face.
    const init = () => {
      if (disposed) return;
      build();
      start();
    };
    if (document.fonts?.ready) document.fonts.ready.then(init);
    else init();

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
        build();
      }, 150);
    });
    resizeObserver.observe(measure);

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);

    return () => {
      disposed = true;
      stop();
      clearTimeout(resizeTimer);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [plain, text, ramp, density]);

  if (plain) return <span className={className}>{text}</span>;

  return (
    <span ref={hostRef} className="relative block">
      {/* Real text for assistive tech and search engines. */}
      <span className="sr-only">{text}</span>
      {/* Invisible copy drives layout, so the canvas never shifts it. */}
      <span ref={measureRef} aria-hidden="true" className={`${className} invisible block`}>
        {text}
      </span>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0" />
    </span>
  );
}
