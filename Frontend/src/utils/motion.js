/**
 * Shared motion vocabulary.
 *
 * Every animation in the product is built from these few primitives so the
 * whole interface moves with one personality: short, eased, and always in
 * service of showing where something came from. Durations stay under
 * ~450ms; anything longer reads as lag rather than polish.
 *
 * Components pass these through `useMotionSafe`, which flattens them to
 * instant transitions when the viewer prefers reduced motion.
 */

export const EASE_OUT = [0.16, 1, 0.3, 1];

export const transitions = {
  snappy: { duration: 0.22, ease: EASE_OUT },
  base: { duration: 0.35, ease: EASE_OUT },
  slow: { duration: 0.5, ease: EASE_OUT },
  spring: { type: "spring", stiffness: 380, damping: 30, mass: 0.7 },
  softSpring: { type: "spring", stiffness: 220, damping: 26 },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: transitions.base },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.base },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.base },
};

export const slideInRight = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: transitions.base },
};

/** Parent variant: children appear one after another rather than at once. */
export function staggerContainer(stagger = 0.06, delayChildren = 0) {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/** Page-level crossfade used by the route transition wrapper. */
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: "easeIn" } },
};

/** Modal/sheet pairing: backdrop fades, panel scales up from slightly below. */
export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const panelVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: transitions.spring },
  exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15 } },
};

/** Chat bubbles enter from the side they belong to. */
export function messageVariants(fromUser) {
  return {
    hidden: { opacity: 0, y: 10, x: fromUser ? 8 : -8, scale: 0.98 },
    visible: { opacity: 1, y: 0, x: 0, scale: 1, transition: transitions.spring },
  };
}

/** Card hover: lift just enough to read as "pick me up". */
export const cardHover = {
  rest: { y: 0 },
  hover: { y: -4, transition: transitions.snappy },
  tap: { y: -1, scale: 0.995 },
};

export const buttonTap = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
  transition: transitions.snappy,
};

/** Scroll-reveal defaults - fire once, slightly before fully in view. */
export const viewportOnce = { once: true, amount: 0.2, margin: "0px 0px -60px 0px" };
