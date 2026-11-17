import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";

const SIZES = { xs: "h-3 w-3", sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-7 w-7" };

/**
 * Stars, read-only or interactive.
 *
 * Read-only mode renders a half-star by clipping, so 4.3 does not get
 * rounded up to something the business has not earned. Interactive mode
 * is a real radio group, so it is reachable and operable by keyboard.
 */
export default function RatingStars({
  value = 0,
  onChange = null,
  size = "md",
  showValue = false,
  count = null,
  label,
  className = "",
}) {
  const { reduce } = useMotionSafe();
  const [hovered, setHovered] = useState(0);
  const dimension = SIZES[size] || SIZES.md;
  const interactive = typeof onChange === "function";
  const shown = interactive && hovered ? hovered : value;

  if (!interactive) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="inline-flex" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((star) => {
            const fill = Math.max(0, Math.min(1, value - (star - 1)));
            return (
              <span key={star} className="relative inline-block">
                <Star className={`${dimension} text-slate-200`} fill="currentColor" />
                {fill > 0 ? (
                  <span
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${fill * 100}%` }}
                  >
                    <Star className={`${dimension} text-warning-500`} fill="currentColor" />
                  </span>
                ) : null}
              </span>
            );
          })}
        </span>
        {showValue ? (
          <span className="text-sm font-semibold text-ink-soft">
            {value ? value.toFixed(1) : "—"}
            {count !== null ? (
              <span className="ml-1 font-normal text-ink-faint">
                ({count})
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="sr-only">
          {value ? `Rated ${value.toFixed(1)} out of 5${count !== null ? ` from ${count} reviews` : ""}` : "Not yet rated"}
        </span>
      </span>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label || "Your rating"}
      className={`inline-flex items-center gap-1 ${className}`}
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onFocus={() => setHovered(star)}
          whileTap={reduce ? undefined : { scale: 0.85 }}
          animate={reduce ? undefined : { scale: shown >= star ? 1.05 : 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="rounded p-0.5 focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <Star
            className={`${dimension} transition-colors ${
              shown >= star ? "text-warning-500" : "text-slate-200"
            }`}
            fill="currentColor"
          />
        </motion.button>
      ))}
    </div>
  );
}
