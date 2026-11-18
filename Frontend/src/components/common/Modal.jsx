import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { backdropVariants, panelVariants } from "../../utils/motion";

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Accessible modal dialog.
 *
 * Handles the things a hand-rolled overlay usually forgets: Escape to
 * close, a focus trap so Tab cannot wander behind the dialog, focus
 * returned to whatever opened it, and the page behind locked from
 * scrolling. On phones it becomes a bottom sheet, because a centred box is
 * hard to reach one-handed.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}) {
  const { variants } = useMotionSafe();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const focusTimer = setTimeout(() => {
      const target = panelRef.current?.querySelector("[data-autofocus]") || panelRef.current;
      target?.focus?.();
    }, 50);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            variants={variants(backdropVariants)}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={variants(panelVariants)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl2 border border-line bg-surface shadow-lift focus:outline-none sm:rounded-xl2 ${
              WIDTHS[size] || WIDTHS.md
            }`}
          >
            {/* Grab handle, phones only */}
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />

            {title ? (
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-ink">{title}</h2>
                  {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <div className="lf-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer ? (
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-slate-50/60 px-5 py-3">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
