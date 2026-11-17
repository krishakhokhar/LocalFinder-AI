import { Clock } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Weekly opening hours.
 *
 * Accepts either shape the API produces: the owner-maintained rows from a
 * registered business ({day, open, close, closed}) or the parsed form of
 * an OpenStreetMap `opening_hours` string ({day, short, text}).
 *
 * When neither is available the component renders an explicit "hours not
 * published" message. It never shows a plausible-looking default.
 */
export default function HoursTable({ hours, openNow = null, className = "" }) {
  const today = new Date().getDay();

  if (!Array.isArray(hours) || hours.length === 0) {
    return (
      <div className={`rounded-card border border-dashed border-line bg-surface p-5 ${className}`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className="h-4 w-4 text-ink-faint" aria-hidden="true" />
          Opening hours
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          This business has not published its opening hours.
        </p>
      </div>
    );
  }

  const rows = hours.map((row, index) => {
    const day = typeof row.day === "number" ? row.day : index;
    const text =
      row.text !== undefined ? row.text : row.closed ? "Closed" : `${row.open} - ${row.close}`;
    return { day, label: DAY_NAMES[day], text };
  });

  return (
    <div className={`rounded-card border border-line bg-surface p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
          <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Opening hours
        </h3>
        {openNow === true ? (
          <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-bold text-success-700">
            Open now
          </span>
        ) : openNow === false ? (
          <span className="rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-bold text-danger-700">
            Closed now
          </span>
        ) : null}
      </div>

      <dl className="mt-3 divide-y divide-line">
        {rows.map((row) => (
          <div
            key={row.day}
            className={`flex items-center justify-between py-2 text-sm ${
              row.day === today ? "font-semibold text-ink" : "text-ink-muted"
            }`}
          >
            <dt>
              {row.label}
              {row.day === today ? (
                <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-2xs font-bold uppercase text-brand-700">
                  Today
                </span>
              ) : null}
            </dt>
            <dd className={row.text === "Closed" ? "text-danger-600" : ""}>{row.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
