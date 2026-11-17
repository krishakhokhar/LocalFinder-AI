import { motion } from "framer-motion";
import useMotionSafe from "../../hooks/useMotionSafe";
import { staggerContainer, fadeUp } from "../../utils/motion";

const PROMPTS = [
  "Best restaurant under ₹500 near me",
  "Salons within 2 km",
  "Find an affordable gym",
  "Electrician near my location",
  "Closest car service centre",
  "Pharmacy open right now",
];

/**
 * Starter prompts.
 *
 * These are examples of what the assistant can be asked - they are not
 * claims about what exists nearby. Every one of them runs a real search
 * when tapped.
 */
export default function SuggestedPrompts({ onPick, compact = false }) {
  const { variants } = useMotionSafe();

  return (
    <motion.div
      variants={variants(staggerContainer(0.05))}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-1.5"
    >
      {(compact ? PROMPTS.slice(0, 3) : PROMPTS).map((prompt) => (
        <motion.button
          key={prompt}
          variants={variants(fadeUp)}
          type="button"
          onClick={() => onPick(prompt)}
          className="rounded-full border border-ai-200 bg-ai-50 px-3 py-1.5 text-xs font-medium text-ai-700 transition-colors hover:border-ai-400 hover:bg-ai-100"
        >
          {prompt}
        </motion.button>
      ))}
    </motion.div>
  );
}
