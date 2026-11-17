import { useReducedMotion } from "framer-motion";

/**
 * Motion that respects the viewer.
 *
 * `prefers-reduced-motion` is handled globally in CSS for keyframe
 * animations, but Framer Motion drives transforms through JavaScript and
 * ignores that media query. These helpers flatten variants and transitions
 * to instant so the preference actually holds everywhere.
 */
export function useMotionSafe() {
  const reduce = useReducedMotion();

  /** Replaces a variants object with a non-moving equivalent. */
  const variants = (value) => (reduce ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : value);

  /** Strips a transition down to nothing. */
  const transition = (value) => (reduce ? { duration: 0 } : value);

  /** Drops hover/tap transforms. */
  const interaction = (value) => (reduce ? {} : value);

  return { reduce, variants, transition, interaction };
}

export default useMotionSafe;
