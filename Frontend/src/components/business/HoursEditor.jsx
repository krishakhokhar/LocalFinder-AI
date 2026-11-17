import { Copy } from "lucide-react";

const DAYS = [
  { day: 1, label: "Monday", short: "Mon" },
  { day: 2, label: "Tuesday", short: "Tue" },
  { day: 3, label: "Wednesday", short: "Wed" },
  { day: 4, label: "Thursday", short: "Thu" },
  { day: 5, label: "Friday", short: "Fri" },
  { day: 6, label: "Saturday", short: "Sat" },
  { day: 0, label: "Sunday", short: "Sun" },
];

export const DEFAULT_HOURS = DAYS.map(({ day }) => ({
  day,
  closed: day === 0,
  open: "09:00",
  close: "18:00",
}));

/**
 * Weekly opening hours editor.
 *
 * Seven explicit rows, each either open with a time range or marked
 * closed. There is no "leave it blank" option on purpose: a blank row
 * would be stored as unknown, and the booking system needs to know when
 * the business is actually open before it can offer a slot.
 */
export default function HoursEditor({ value = DEFAULT_HOURS, onChange, error }) {
  const rows = DAYS.map(
    ({ day }) => value.find((row) => row.day === day) || { day, closed: false, open: "09:00", close: "18:00" }
  );

  const update = (day, patch) => {
    onChange(rows.map((row) => (row.day === day ? { ...row, ...patch } : row)));
  };

  const copyToAll = (source) => {
    onChange(
      rows.map((row) =>
        row.day === source.day ? row : { ...row, open: source.open, close: source.close, closed: source.closed }
      )
    );
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink-soft">Opening hours</p>

      <div className="divide-y divide-line overflow-hidden rounded-card border border-line">
        {DAYS.map(({ day, label, short }) => {
          const row = rows.find((item) => item.day === day);
          const invalid = !row.closed && row.open >= row.close;

          return (
            <div key={day} className="flex flex-wrap items-center gap-3 bg-surface p-3">
              <span className="w-20 shrink-0 text-sm font-medium text-ink-soft">
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </span>

              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={!row.closed}
                  onChange={(event) => update(day, { closed: !event.target.checked })}
                  className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-600/30"
                />
                {row.closed ? "Closed" : "Open"}
              </label>

              {!row.closed ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={row.open}
                      onChange={(event) => update(day, { open: event.target.value })}
                      aria-label={`${label} opening time`}
                      className={`h-9 rounded-lg border bg-surface px-2 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-600/20 ${
                        invalid ? "border-danger-300" : "border-line"
                      }`}
                    />
                    <span className="text-xs text-ink-faint">to</span>
                    <input
                      type="time"
                      value={row.close}
                      onChange={(event) => update(day, { close: event.target.value })}
                      aria-label={`${label} closing time`}
                      className={`h-9 rounded-lg border bg-surface px-2 text-sm text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-600/20 ${
                        invalid ? "border-danger-300" : "border-line"
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToAll(row)}
                    title="Apply these hours to every day"
                    className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    <span className="hidden sm:inline">Copy to all</span>
                  </button>
                </>
              ) : null}

              {invalid ? (
                <p className="w-full text-xs font-medium text-danger-600">
                  Closing time must be after opening time.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
