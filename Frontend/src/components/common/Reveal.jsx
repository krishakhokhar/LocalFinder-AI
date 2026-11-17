import { motion } from "framer-motion";
import useMotionSafe from "../../hooks/useMotionSafe";
import { fadeUp, staggerContainer, viewportOnce } from "../../utils/motion";

/**
 * Scroll reveal. Fires once, slightly before the element is fully in view,
 * so content is already settled by the time the reader reaches it.
 */
export function Reveal({ children, delay = 0, className = "", as = "div", ...props }) {
  const { variants, transition } = useMotionSafe();
  const Component = motion[as] || motion.div;

  return (
    <Component
      variants={variants(fadeUp)}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={transition({ delay })}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}

/** Wrap a list so its children reveal one after another. */
export function RevealGroup({ children, stagger = 0.06, className = "", as = "div", ...props }) {
  const { variants } = useMotionSafe();
  const Component = motion[as] || motion.div;

  return (
    <Component
      variants={variants(staggerContainer(stagger))}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}

/** A single item inside a RevealGroup. */
export function RevealItem({ children, className = "", as = "div", ...props }) {
  const { variants } = useMotionSafe();
  const Component = motion[as] || motion.div;

  return (
    <Component variants={variants(fadeUp)} className={className} {...props}>
      {children}
    </Component>
  );
}

export default Reveal;
