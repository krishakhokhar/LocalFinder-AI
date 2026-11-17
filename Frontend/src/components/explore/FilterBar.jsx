import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownWideNarrow, Clock, RotateCcw, SlidersHorizontal, Star } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { categoryConfig } from "../../utils/categories";

export const RADIUS_OPTIONS = [
  { value: 1000, label: "1 km" },
  { value: 3000, label: "3 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
];

export const SORT_OPTIONS = [
  { value: "distance", label: "Nearest first" },
  { value: "rating", label: "Highest rated" },
  { value: "relevance", label: "Best match" },
];

const RATING_OPTIONS = [
  { value: 0, label: "Any rating" },
  { value: 3, label: "3.0+" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

/**
 * Filters for the Explore page.
 *
 * Two filters are deliberately conditional. "Open now" only keeps places
 * whose hours we actually know, and the price filter only applies to
 * businesses that published prices - both say so in their help text,
 * because a filter that silently drops places with missing data would look
 * like those places do not exist.
 */
export default function FilterBar({ filters, categories, onChange, onReset, resultCount, loading }) {
  const { reduce } = useMotionSafe();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const set = (patch) => onChange({ ...filters, ...patch, page: 1 });

  const activeCount =
    (filters.openNow ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.radius !== 3000 ? 1 : 0) +
    (filters.sort !== "distance" ? 1 : 0);

  return (
    <div className="border-b border-line bg-surface">
      {/* Category rail */}
      <div className="lf-container">
        <div className="lf-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-3">
          {categories.map((category) => {
            const config = categoryConfig(category.key);
            const Icon = config.icon;
            const active = filters.category === category.key;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => set({ category: category.key })}
                aria-pressed={active}
                className={`relative inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-brand-600 bg-brand-600 text-white shadow-soft"
                    : "border-line bg-surface text-ink-muted hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-line bg-slate-50/60">
        <div className="lf-container flex flex-wrap items-center gap-2 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="hidden text-xs font-semibold text-ink-faint sm:inline">Within</span>
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => set({ radius: option.value })}
                  aria-pressed={filters.radius === option.value}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    filters.radius === option.value
                      ? "bg-brand-600 text-white"
                      : "text-ink-muted hover:bg-slate-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-1.5">
            <span className="sr-only">Sort results</span>
            <ArrowDownWideNarrow className="h-4 w-4 text-ink-faint" aria-hidden="true" />
            <select
              value={filters.sort}
              onChange={(event) => set({ sort: event.target.value })}
              className="h-8 rounded-lg border border-line bg-surface pl-2 pr-7 text-xs font-semibold text-ink-soft focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => set({ openNow: !filters.openNow })}
            aria-pressed={filters.openNow}
            title="Only places whose published opening hours say they are open right now"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
              filters.openNow
                ? "border-success-500 bg-success-50 text-success-700"
                : "border-line bg-surface text-ink-muted hover:bg-slate-100"
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Open now
          </button>

          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
              advancedOpen || activeCount > 0
                ? "border-brand-200 bg-brand-50 text-brand-700"
                : "border-line bg-surface text-ink-muted hover:bg-slate-100"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            More filters
            {activeCount > 0 ? (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            ) : null}
          </button>

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset
            </button>
          ) : null}

          <span className="ml-auto text-xs font-medium text-ink-muted" aria-live="polite">
            {loading ? "Searching…" : `${resultCount} ${resultCount === 1 ? "result" : "results"}`}
          </span>
        </div>

        <AnimatePresence initial={false}>
          {advancedOpen ? (
            <motion.div
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={reduce ? {} : { height: "auto", opacity: 1 }}
              exit={reduce ? {} : { height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-line"
            >
              <div className="lf-container grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-soft">
                    <Star className="h-3.5 w-3.5 text-warning-500" aria-hidden="true" />
                    Minimum rating
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {RATING_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => set({ minRating: option.value })}
                        aria-pressed={filters.minRating === option.value}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          filters.minRating === option.value
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-line bg-surface text-ink-muted hover:bg-slate-100"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-2xs text-ink-faint">
                    Only places reviewed on LocalFinder have a rating, so this hides unreviewed places.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold text-ink-soft">Maximum price</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="50"
                      inputMode="numeric"
                      value={filters.maxPrice ?? ""}
                      onChange={(event) =>
                        set({ maxPrice: event.target.value ? Number(event.target.value) : null })
                      }
                      placeholder="e.g. 500"
                      aria-label="Maximum price in rupees"
                      className="h-9 w-32 rounded-lg border border-line bg-surface px-3 text-sm text-ink-soft focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                    />
                    {filters.maxPrice ? (
                      <button
                        type="button"
                        onClick={() => set({ maxPrice: null })}
                        className="text-xs font-semibold text-ink-muted underline-offset-2 hover:underline"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-2xs text-ink-faint">
                    Applies to businesses that published service prices. Map data carries no pricing.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold text-ink-soft">Source</p>
                  <button
                    type="button"
                    onClick={() => set({ includeExternal: !filters.includeExternal })}
                    aria-pressed={!filters.includeExternal}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      filters.includeExternal
                        ? "border-line bg-surface text-ink-muted hover:bg-slate-100"
                        : "border-brand-600 bg-brand-600 text-white"
                    }`}
                  >
                    Registered businesses only
                  </button>
                  <p className="mt-1.5 text-2xs text-ink-faint">
                    Hides OpenStreetMap places and shows only businesses listed with LocalFinder.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
