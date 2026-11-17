import { useState } from "react";
import { motion } from "framer-motion";
import useMotionSafe from "../../hooks/useMotionSafe";
import { CHART, SERIES_COLORS } from "./chartTokens";

/**
 * Horizontal bars for "how much, by what" - top services, counts by
 * category, bookings by status.
 *
 * Horizontal rather than vertical because the categories are words:
 * rotated axis labels are hard to read, and a horizontal bar gives the
 * label a whole line of its own.
 *
 * Mark specs: bars capped at 24px thick with a 4px rounded data-end and
 * a square baseline edge, the value labelled at the tip, and each bar
 * its own hover target that lifts on hover. No gridlines - with the
 * value printed at every tip they would be redundant ink.
 */
export default function BarList({
  items = [],
  color = SERIES_COLORS[0],
  formatValue = (value) => value.toLocaleString("en-IN"),
  emptyMessage = "Nothing to show yet.",
  max: maxOverride,
  secondaryLabel,
}) {
  const { reduce } = useMotionSafe();
  const [hovered, setHovered] = useState(null);

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-4 py-8 text-center">
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
      </div>
    );
  }

  const max = maxOverride || Math.max(1, ...items.map((item) => item.value || 0));

  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => {
        const percent = Math.max(1.5, ((item.value || 0) / max) * 100);
        const isHovered = hovered === index;

        return (
          <li
            key={item.label}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            className="group rounded-lg px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs font-medium text-ink-soft" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-ink">
                {formatValue(item.value || 0)}
                {item.secondary !== undefined && item.secondary !== null ? (
                  <span className="ml-1.5 font-normal text-ink-faint">
                    {item.secondary}
                    {secondaryLabel ? ` ${secondaryLabel}` : ""}
                  </span>
                ) : null}
              </span>
            </div>

            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-sm bg-slate-100">
              <motion.div
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : index * 0.05 }}
                className="h-full"
                style={{
                  background: item.color || color,
                  // Rounded at the data end, square at the baseline.
                  borderRadius: `0 ${CHART.barRadius}px ${CHART.barRadius}px 0`,
                  opacity: hovered === null || isHovered ? 1 : 0.55,
                  transition: "opacity .15s ease",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
