import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Compact pager. Shows at most five numbered pages around the current one
 * so it stays on a single line on a phone.
 */
export default function Pagination({ page, pages, onChange, className = "" }) {
  if (!pages || pages <= 1) return null;

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const numbers = [];
  for (let index = start; index <= end; index += 1) numbers.push(index);

  const buttonBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav aria-label="Pagination" className={`flex items-center justify-center gap-1.5 ${className}`}>
      <button
        type="button"
        className={`${buttonBase} border border-line bg-surface text-ink-muted hover:bg-slate-50`}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      {start > 1 ? <span className="px-1 text-ink-faint">...</span> : null}

      {numbers.map((number) => (
        <button
          key={number}
          type="button"
          onClick={() => onChange(number)}
          aria-current={number === page ? "page" : undefined}
          className={`${buttonBase} ${
            number === page
              ? "bg-brand-600 text-white shadow-soft"
              : "border border-line bg-surface text-ink-muted hover:bg-slate-50"
          }`}
        >
          {number}
        </button>
      ))}

      {end < pages ? <span className="px-1 text-ink-faint">...</span> : null}

      <button
        type="button"
        className={`${buttonBase} border border-line bg-surface text-ink-muted hover:bg-slate-50`}
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
