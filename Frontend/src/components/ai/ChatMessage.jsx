import { Fragment } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { messageVariants } from "../../utils/motion";

/**
 * Renders **bold** and line breaks from the model's reply.
 *
 * Built as React nodes rather than injected HTML: the text comes from a
 * language model, and nothing that arrives as a string should ever reach
 * dangerouslySetInnerHTML. Only bold is supported - the prompt asks for
 * plain prose, and anything richer would be decoration, not meaning.
 */
function RichText({ text }) {
  const lines = String(text || "").split("\n");

  return lines.map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {lineIndex > 0 ? <br /> : null}
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={partIndex} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={partIndex}>{part}</Fragment>
        )
      )}
    </Fragment>
  ));
}

export default function ChatMessage({ message, children }) {
  const { variants } = useMotionSafe();
  const fromUser = message.sender === "user";

  return (
    <motion.div
      variants={variants(messageVariants(fromUser))}
      initial="hidden"
      animate="visible"
      className={`flex gap-2 ${fromUser ? "justify-end" : "justify-start"}`}
    >
      {!fromUser ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-50 text-ai-600">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      ) : null}

      <div className={`min-w-0 max-w-[85%] ${fromUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            fromUser
              ? "rounded-br-md bg-brand-600 text-white"
              : message.tone === "error"
                ? "rounded-bl-md border border-danger-100 bg-danger-50 text-danger-700"
                : "rounded-bl-md border border-line bg-surface text-ink-soft"
          }`}
        >
          <RichText text={message.text} />
        </div>

        {children}
      </div>
    </motion.div>
  );
}
