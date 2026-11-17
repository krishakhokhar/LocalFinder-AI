import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";

/**
 * Three bouncing dots while the assistant works.
 *
 * Announced politely to screen readers so the wait is not silent for
 * someone who cannot see the animation.
 */
export default function TypingIndicator({ label = "Searching nearby places" }) {
  const { reduce } = useMotionSafe();

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-50 text-ai-600">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      </span>

      <span className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3">
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-ai-500 animate-bounce-dot"
              style={{ animationDelay: `${index * 0.16}s` }}
            />
          ))}
        </span>
        <span className="text-xs font-medium text-ink-faint">{label}</span>
      </span>
    </motion.div>
  );
}
