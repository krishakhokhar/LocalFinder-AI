import { motion } from "motion/react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { pageTransition } from "../../utils/motion";

/**
 * Wraps a route's content in a short crossfade.
 *
 * Deliberately subtle: a page change should feel continuous, not
 * theatrical, and anything slower than ~300ms makes navigation feel heavy.
 */
export default function PageTransition({ children, className = "" }) {
  const { reduce } = useMotionSafe();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      className={className}
    >
      {children}
    </motion.div>
  );
}
