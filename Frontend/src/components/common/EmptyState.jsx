import { motion } from "framer-motion";
import useMotionSafe from "../../hooks/useMotionSafe";
import { fadeUp } from "../../utils/motion";

/**
 * The state users see most often when something is new or a filter is too
 * tight. It always says what happened, why, and offers the next step -
 * an empty screen with a shrug is a dead end.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action = null,
  secondaryAction = null,
  tone = "brand",
  className = "",
}) {
  const { variants } = useMotionSafe();
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    ai: "bg-ai-50 text-ai-600",
    neutral: "bg-slate-100 text-ink-muted",
    warning: "bg-warning-50 text-warning-600",
  };

  return (
    <motion.div
      variants={variants(fadeUp)}
      initial="hidden"
      animate="visible"
      className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}
    >
      {Icon ? (
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${tones[tone] || tones.brand}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="font-display text-base font-bold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </motion.div>
  );
}
