import { useEffect } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Motion that respects the viewer.
 *
 * `prefers-reduced-motion` is handled globally in CSS for keyframe
 * animations, but Framer Motion drives transforms through JavaScript and
 * ignores that media query. These helpers flatten variants and transitions
 * to instant so the preference actually holds everywhere.
 */
const OVERRIDE_KEY = "localfinder:force-motion";

/**
 * Development-only escape hatch.
 *
 * When the machine has "reduce motion" switched on, every animation in the
 * product is correctly disabled - which also makes it impossible to review
 * the animations while building them. This lets a developer preview them
 * on their own machine without changing an OS setting.
 *
 * It is ignored in production builds, so a real viewer's accessibility
 * preference is always honoured.
 */
export function isMotionForced() {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem(OVERRIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMotionForced(on) {
  try {
    if (on) localStorage.setItem(OVERRIDE_KEY, "1");
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* private mode - the preview simply does not persist */
  }
  window.location.reload();
}

export function useMotionSafe() {
  const systemReduce = useReducedMotion();
  const reduce = systemReduce && !isMotionForced();

  // Every animation in the product passes through here, so when the OS asks
  // for reduced motion the whole interface goes still - correctly, but
  // indistinguishably from the animations being broken. Say so in
  // development rather than leaving it to guesswork.
  useEffect(() => {
    if (!import.meta.env.DEV || !reduce) return;
    console.warn(
      "[motion] prefers-reduced-motion is ON, so all animations are intentionally disabled.\n" +
        "  Windows: Settings > Accessibility > Visual effects > Animation effects -> On\n" +
        "  macOS:   System Settings > Accessibility > Display > Reduce motion -> Off\n" +
        "  Chrome:  DevTools > ⋮ > More tools > Rendering > Emulate CSS prefers-reduced-motion -> No emulation\n" +
        "  Reload after changing it."
    );
  }, [reduce]);

  /** Replaces a variants object with a non-moving equivalent. */
  const variants = (value) => (reduce ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : value);

  /** Strips a transition down to nothing. */
  const transition = (value) => (reduce ? { duration: 0 } : value);

  /** Drops hover/tap transforms. */
  const interaction = (value) => (reduce ? {} : value);

  // `systemReduce` is what the machine asked for; `reduce` is what is
  // actually applied after the dev override. The banner needs both.
  return { reduce, systemReduce, variants, transition, interaction };
}

export default useMotionSafe;
