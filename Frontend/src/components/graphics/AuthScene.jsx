import { motion } from "motion/react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { EASE_OUT } from "../../utils/motion";

/**
 * Decorative artwork for the auth split-screen, one scene per intent.
 *
 * These are drawn as inline SVG rather than photographs on purpose:
 *
 *  - nothing is fetched, so the panel paints with the page and cannot
 *    leave a grey rectangle on a slow connection,
 *  - there is no licensing question and no third-party request carrying
 *    the viewer's IP to an image host,
 *  - the artwork uses the product's own palette, so it stays correct if
 *    the brand colours change.
 *
 * Everything is `aria-hidden`: the panel's meaning is carried by its
 * heading and list, and a screen reader gains nothing from the drawing.
 * All motion goes through `useMotionSafe`, so it flattens to a static
 * image when the viewer prefers reduced motion.
 */

const BRAND = "#2563EB";
const AI = "#8B5CF6";
const SUCCESS = "#10B981";
const AMBER = "#F59E0B";
const PINK = "#EC4899";

/** Pin head + tail, rotated the way Leaflet draws a teardrop marker. */
function Pin({ x, y, color, delay, reduce }) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: -18, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0 } : { delay, type: "spring", stiffness: 300, damping: 18 }}
      style={{ transformOrigin: `${x}px ${y + 10}px` }}
    >
      <path
        d={`M ${x} ${y - 10} a 10 10 0 0 1 10 10 c 0 7 -10 16 -10 16 s -10 -9 -10 -16 a 10 10 0 0 1 10 -10 z`}
        fill={color}
      />
      <circle cx={x} cy={y} r="3.6" fill="#fff" />
    </motion.g>
  );
}

function DiscoverScene({ reduce }) {
  // A stylised street grid with a river, a search radius and category pins.
  return (
    <svg viewBox="0 0 400 320" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="lfWater" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="lfPark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SUCCESS} stopOpacity="0.45" />
          <stop offset="100%" stopColor={SUCCESS} stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* blocks */}
      <g opacity="0.16" stroke="#fff" strokeWidth="1.2">
        {[40, 90, 140, 190, 240, 290].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="400" y2={y} />
        ))}
        {[50, 110, 170, 230, 290, 350].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="320" />
        ))}
      </g>

      {/* arterial roads */}
      <path d="M0 140 H400" stroke={AMBER} strokeWidth="6" strokeLinecap="round" opacity="0.55" />
      <path d="M230 0 V320" stroke={AMBER} strokeWidth="5" strokeLinecap="round" opacity="0.4" />

      {/* river + park */}
      <path
        d="M-10 250 C 90 215, 150 285, 250 240 S 380 190, 410 215"
        stroke="url(#lfWater)"
        strokeWidth="22"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="60" y="48" width="92" height="62" rx="12" fill="url(#lfPark)" />

      {/* search radius */}
      <motion.circle
        cx="200"
        cy="160"
        r="74"
        fill={BRAND}
        fillOpacity="0.1"
        stroke={BRAND}
        strokeOpacity="0.5"
        strokeDasharray="6 7"
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT }}
        style={{ transformOrigin: "200px 160px" }}
      />
      {!reduce ? (
        <motion.circle
          cx="200"
          cy="160"
          r="74"
          fill="none"
          stroke={BRAND}
          strokeWidth="1.5"
          initial={{ scale: 0.6, opacity: 0.6 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: "200px 160px" }}
        />
      ) : null}

      {/* the viewer */}
      <circle cx="200" cy="160" r="9" fill="#fff" />
      <circle cx="200" cy="160" r="5.5" fill={BRAND} />

      <Pin x={128} y={104} color={PINK} delay={0.25} reduce={reduce} />
      <Pin x={268} y={118} color={AMBER} delay={0.4} reduce={reduce} />
      <Pin x={246} y={214} color={AI} delay={0.55} reduce={reduce} />
      <Pin x={142} y={210} color={SUCCESS} delay={0.7} reduce={reduce} />
    </svg>
  );
}

function CommunityScene({ reduce }) {
  // People and places connecting around a shared centre.
  const nodes = [
    { x: 92, y: 86, c: PINK },
    { x: 300, y: 76, c: AMBER },
    { x: 330, y: 206, c: AI },
    { x: 78, y: 214, c: SUCCESS },
    { x: 200, y: 54, c: BRAND },
  ];

  return (
    <svg viewBox="0 0 400 320" className="h-full w-full" aria-hidden="true">
      {nodes.map((n, i) => (
        <motion.line
          key={`l${i}`}
          x1="200"
          y1="160"
          x2={n.x}
          y2={n.y}
          stroke="#fff"
          strokeOpacity="0.28"
          strokeWidth="1.6"
          strokeDasharray="4 6"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.2 + i * 0.1, duration: 0.5, ease: EASE_OUT }}
        />
      ))}

      {nodes.map((n, i) => (
        <motion.g
          key={`n${i}`}
          initial={reduce ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reduce ? { duration: 0 } : { delay: 0.3 + i * 0.1, type: "spring", stiffness: 300, damping: 18 }
          }
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
        >
          <circle cx={n.x} cy={n.y} r="26" fill={n.c} fillOpacity="0.22" />
          <circle cx={n.x} cy={n.y} r="17" fill={n.c} fillOpacity="0.9" />
          {/* generic person glyph - no real people are depicted */}
          <circle cx={n.x} cy={n.y - 4.5} r="5" fill="#fff" />
          <path d={`M ${n.x - 8} ${n.y + 10} a 8 8 0 0 1 16 0 z`} fill="#fff" />
        </motion.g>
      ))}

      <motion.g
        initial={reduce ? false : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
        style={{ transformOrigin: "200px 160px" }}
      >
        <circle cx="200" cy="160" r="46" fill="#fff" fillOpacity="0.12" />
        <circle cx="200" cy="160" r="34" fill={BRAND} />
        <path
          d="M200 142 a 12 12 0 0 1 12 12 c 0 9 -12 20 -12 20 s -12 -11 -12 -20 a 12 12 0 0 1 12 -12 z"
          fill="#fff"
        />
        <circle cx="200" cy="154.5" r="4.4" fill={BRAND} />
      </motion.g>
    </svg>
  );
}

function GrowScene({ reduce }) {
  // A storefront with trade rising month on month.
  const bars = [
    { x: 236, h: 42, c: BRAND },
    { x: 272, h: 68, c: AI },
    { x: 308, h: 96, c: SUCCESS },
  ];

  return (
    <svg viewBox="0 0 400 320" className="h-full w-full" aria-hidden="true">
      {/* storefront */}
      <motion.g
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT }}
      >
        <rect x="52" y="150" width="140" height="110" rx="10" fill="#fff" fillOpacity="0.12" />
        <path d="M44 150 L 122 104 L 200 150 Z" fill={BRAND} fillOpacity="0.85" />
        {/* awning */}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M ${58 + i * 34} 150 h 34 v 16 a 17 17 0 0 1 -34 0 z`}
            fill={i % 2 === 0 ? AMBER : "#fff"}
            fillOpacity={i % 2 === 0 ? 0.9 : 0.75}
          />
        ))}
        <rect x="104" y="196" width="38" height="64" rx="5" fill={BRAND} fillOpacity="0.55" />
        <circle cx="134" cy="228" r="2.6" fill="#fff" />
        <rect x="62" y="196" width="30" height="26" rx="5" fill="#fff" fillOpacity="0.35" />
        <rect x="154" y="196" width="30" height="26" rx="5" fill="#fff" fillOpacity="0.35" />
      </motion.g>

      {/* growth bars */}
      {bars.map((b, i) => (
        <motion.rect
          key={b.x}
          x={b.x}
          width="24"
          rx="6"
          fill={b.c}
          initial={reduce ? false : { height: 0, y: 260 }}
          animate={{ height: b.h, y: 260 - b.h }}
          transition={reduce ? { duration: 0 } : { delay: 0.3 + i * 0.12, duration: 0.5, ease: EASE_OUT }}
          height={reduce ? b.h : undefined}
          y={reduce ? 260 - b.h : undefined}
        />
      ))}
      <line x1="226" y1="262" x2="344" y2="262" stroke="#fff" strokeOpacity="0.3" strokeWidth="2" />

      {/* trend arrow */}
      <motion.path
        d="M232 150 L 272 122 L 300 136 L 340 92"
        fill="none"
        stroke={SUCCESS}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { delay: 0.5, duration: 0.7, ease: EASE_OUT }}
      />
      <motion.path
        d="M326 90 L 342 90 L 342 106"
        fill="none"
        stroke={SUCCESS}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? { duration: 0 } : { delay: 1.1, duration: 0.25 }}
      />

      {/* verified tick */}
      <motion.g
        initial={reduce ? false : { opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduce ? { duration: 0 } : { delay: 0.75, type: "spring", stiffness: 320, damping: 16 }
        }
        style={{ transformOrigin: "180px 118px" }}
      >
        <circle cx="180" cy="118" r="19" fill={SUCCESS} />
        <path
          d="M171 118 l 6 6 l 12 -13"
          fill="none"
          stroke="#fff"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  );
}

const SCENES = { discover: DiscoverScene, community: CommunityScene, grow: GrowScene };

export default function AuthScene({ variant = "discover", className = "" }) {
  const { reduce } = useMotionSafe();
  const Scene = SCENES[variant] || DiscoverScene;

  return (
    <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
      <Scene reduce={reduce} />
    </div>
  );
}
