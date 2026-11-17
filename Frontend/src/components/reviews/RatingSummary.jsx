import { motion } from "framer-motion";
import { MessageSquareQuote } from "lucide-react";
import RatingStars from "./RatingStars";
import useMotionSafe from "../../hooks/useMotionSafe";

/**
 * Average plus a 5-to-1 histogram.
 *
 * Shows an explicit empty state when nobody has reviewed yet, rather
 * than a zero-star average - "0.0" reads as a terrible business, when
 * the truth is that nothing is known.
 */
export default function RatingSummary({ rating, count, distribution, className = "" }) {
  const { reduce } = useMotionSafe();

  if (!count) {
    return (
      <div className={`rounded-card border border-dashed border-line bg-surface p-5 text-center ${className}`}>
        <MessageSquareQuote className="mx-auto h-6 w-6 text-ink-faint" aria-hidden="true" />
        <p className="mt-2 font-display text-sm font-bold text-ink">No reviews yet</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Be the first to review this place. Ratings on LocalFinder come only from people who write them.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-card border border-line bg-surface p-5 ${className}`}>
      <div className="flex items-center gap-5">
        <div className="text-center">
          <p className="font-display text-4xl font-extrabold leading-none text-ink">{rating.toFixed(1)}</p>
          <RatingStars value={rating} size="sm" className="mt-1.5" />
          <p className="mt-1 text-xs text-ink-muted">
            {count} {count === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const value = distribution?.[star] || 0;
            const percent = count > 0 ? (value / count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-3 text-right text-xs font-medium text-ink-muted">{star}</span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    initial={reduce ? false : { width: 0 }}
                    whileInView={{ width: `${percent}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: (5 - star) * 0.05 }}
                    className="h-full rounded-full bg-warning-500"
                  />
                </div>
                <span className="w-6 text-right text-xs tabular-nums text-ink-faint">{value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
