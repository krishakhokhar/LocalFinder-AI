import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Search, Sparkles, X } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";
import useSearchHistory from "../../hooks/useSearchHistory";

const SUGGESTIONS = [
  "haircut",
  "biryani",
  "gym",
  "car wash",
  "pizza",
  "spa",
  "dentist",
  "pharmacy",
  "coffee",
  "electrician",
];

/**
 * Search box with recent searches and lightweight suggestions.
 *
 * Suggestions are static, common search words - they are hints for the
 * filter box, not claims that such a business exists nearby. Results
 * themselves always come from the live search.
 */
export default function SearchField({ value, onChange, onSubmit, placeholder = "Search by name or service", resultCount = null }) {
  const { reduce } = useMotionSafe();
  const { history, remember, forget } = useSearchHistory();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const matches = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return SUGGESTIONS.slice(0, 6);
    return SUGGESTIONS.filter((item) => item.includes(term) && item !== term).slice(0, 5);
  }, [value]);

  const choose = (term) => {
    onChange(term);
    remember(term);
    onSubmit?.(term);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) remember(value.trim());
          onSubmit?.(value);
          setOpen(false);
        }}
      >
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
          placeholder={placeholder}
          aria-label="Search results"
          aria-expanded={open}
          className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-20 text-sm text-ink-soft transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {resultCount !== null && !value ? (
            <span className="hidden text-xs font-semibold text-ink-faint sm:inline">{resultCount}</span>
          ) : null}
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                onSubmit?.("");
              }}
              aria-label="Clear search"
              className="rounded-md p-1 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </form>

      <AnimatePresence>
        {open && (history.length > 0 || matches.length > 0) ? (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-[600] mt-2 overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-lift"
          >
            {history.length > 0 ? (
              <div className="pb-1">
                <p className="px-2.5 pb-1 pt-1.5 text-2xs font-bold uppercase tracking-wider text-ink-faint">
                  Recent
                </p>
                {history.slice(0, 4).map((term) => (
                  <div key={term} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => choose(term)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-slate-50"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                      <span className="truncate">{term}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => forget(term)}
                      aria-label={`Remove ${term} from recent searches`}
                      className="mr-1 rounded-md p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-slate-100 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {matches.length > 0 ? (
              <div className={history.length > 0 ? "border-t border-line pt-1" : ""}>
                <p className="px-2.5 pb-1 pt-1.5 text-2xs font-bold uppercase tracking-wider text-ink-faint">
                  Try searching for
                </p>
                <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
                  {matches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => choose(term)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
