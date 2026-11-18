import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { EASE_OUT } from "../../utils/motion";

/**
 * "Find <category> near you", where the category keeps changing.
 *
 * The word sits in a tinted pill that resizes to fit it. Framer's `layout`
 * animates that resize as a transform, so the words either side glide
 * rather than jumping - which is what makes the line read as one moving
 * object instead of three separate pieces.
 *
 * Every category here is one the search actually supports. Nothing is a
 * made-up business name.
 */
const WORDS = [
  { text: "salons", fg: "#BE185D", bg: "rgba(236,72,153,0.12)", ring: "rgba(236,72,153,0.28)" },
  { text: "restaurants", fg: "#C2410C", bg: "rgba(249,115,22,0.12)", ring: "rgba(249,115,22,0.28)" },
  { text: "gyms", fg: "#6D28D9", bg: "rgba(139,92,246,0.12)", ring: "rgba(139,92,246,0.28)" },
  { text: "pharmacies", fg: "#B91C1C", bg: "rgba(239,68,68,0.12)", ring: "rgba(239,68,68,0.28)" },
  { text: "supermarkets", fg: "#B45309", bg: "rgba(245,158,11,0.14)", ring: "rgba(245,158,11,0.30)" },
  { text: "car services", fg: "#047857", bg: "rgba(16,185,129,0.12)", ring: "rgba(16,185,129,0.28)" },
];

const INTERVAL_MS = 2300;

export default function RotatingWords() {
  const { reduce } = useMotionSafe();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % WORDS.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reduce]);

  const active = WORDS[reduce ? 0 : index];

  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
      <span className="font-medium tracking-tight text-ink-muted">Find</span>

      <motion.span
        layout={!reduce}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
        className="relative inline-flex items-center rounded-2xl px-3.5 py-1 font-extrabold tracking-tight"
        style={{
          color: active.fg,
          backgroundColor: active.bg,
          boxShadow: `inset 0 0 0 1px ${active.ring}`,
        }}
      >
        {/* `mode="wait"` keeps one word in the pill at a time, so the pill
            resizes once per change instead of twice. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={active.text}
            initial={reduce ? false : { y: 12, opacity: 0, filter: "blur(5px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={reduce ? undefined : { y: -12, opacity: 0, filter: "blur(5px)" }}
            transition={reduce ? { duration: 0 } : { duration: 0.34, ease: EASE_OUT }}
            className="block whitespace-nowrap"
          >
            {active.text}
          </motion.span>
        </AnimatePresence>
      </motion.span>

      <span className="font-medium tracking-tight text-ink-muted">near you</span>
    </span>
  );
}
