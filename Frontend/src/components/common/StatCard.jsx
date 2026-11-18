import { motion } from "motion/react";
import useMotionSafe from "../../hooks/useMotionSafe";

const TONES = {
  brand: "bg-brand-50 text-brand-600",
  ai: "bg-ai-50 text-ai-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-slate-100 text-ink-muted",
};

/**
 * A single number, presented as a number.
 *
 * Not every metric wants a chart. A total with no shape to it reads far
 * better as a large figure than as a one-bar bar chart.
 *
 * `value` of null means "not known" and renders as a dash with a note -
 * distinct from zero, which is a real measurement. An average rating with
 * no reviews is unknown, not 0.0.
 */
export default function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "brand",
  hint,
  unknownNote = "No data yet",
  action,
  className = "",
}) {
  const { reduce } = useMotionSafe();
  const known = value !== null && value !== undefined;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      className={`rounded-card border border-line bg-surface p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        {Icon ? (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[tone] || TONES.brand}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 font-display text-2xl font-extrabold tabular-nums text-ink">
        {known ? (
          <>
            {typeof value === "number" ? value.toLocaleString("en-IN") : value}
            {unit ? <span className="ml-1 text-base font-bold text-ink-muted">{unit}</span> : null}
          </>
        ) : (
          <span className="text-ink-faint">&mdash;</span>
        )}
      </p>

      <p className="mt-0.5 text-xs text-ink-faint">{known ? hint : unknownNote}</p>

      {action ? <div className="mt-2.5">{action}</div> : null}
    </motion.div>
  );
}
