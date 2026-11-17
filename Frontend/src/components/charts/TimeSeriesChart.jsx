import { useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import useElementWidth from "./useElementWidth";
import { CHART, SERIES_COLORS, formatTick, niceTicks } from "./chartTokens";

const PADDING = { top: 16, right: 20, bottom: 26, left: 44 };

/**
 * Multi-series line chart over time.
 *
 * Follows the house mark specs: 2px round-capped lines, a 10% area wash
 * for the single-series case, solid hairline gridlines, and end markers
 * with a 2px surface ring so they stay legible where lines cross.
 *
 * The hover layer is part of the chart, not an extra. A crosshair snaps
 * to the nearest x position and one tooltip lists every series at that
 * point, so the pointer never has to land on a 2px line. Everything the
 * tooltip shows is also reachable without hovering, through the table
 * view - which is required here rather than optional, because one series
 * colour sits below 3:1 contrast against white.
 */
export default function TimeSeriesChart({
  data = [],
  series = [],
  height = 220,
  formatX = (value) => value,
  formatValue = (value) => value.toLocaleString("en-IN"),
  emptyMessage = "No activity in this period yet.",
  caption,
}) {
  const [container, width] = useElementWidth();
  const [activeIndex, setActiveIndex] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const hasData = data.length > 0 && series.length > 0;
  const hasAnyValue = hasData && data.some((row) => series.some((item) => (row[item.key] || 0) > 0));

  const plot = useMemo(() => {
    if (!hasData) return null;

    const innerWidth = Math.max(10, width - PADDING.left - PADDING.right);
    const innerHeight = Math.max(10, height - PADDING.top - PADDING.bottom);

    const maxValue = Math.max(1, ...data.flatMap((row) => series.map((item) => row[item.key] || 0)));
    const ticks = niceTicks(maxValue);
    const axisMax = ticks[ticks.length - 1];

    const xAt = (index) =>
      PADDING.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
    const yAt = (value) => PADDING.top + innerHeight - (value / axisMax) * innerHeight;

    const paths = series.map((item, slot) => {
      const color = item.color || SERIES_COLORS[slot % SERIES_COLORS.length];
      const points = data.map((row, index) => [xAt(index), yAt(row[item.key] || 0)]);
      const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
      const baseline = PADDING.top + innerHeight;
      const area = `${line} L${points[points.length - 1][0]},${baseline} L${points[0][0]},${baseline} Z`;
      return { ...item, color, points, line, area };
    });

    return { innerWidth, innerHeight, ticks, axisMax, xAt, yAt, paths, maxValue };
  }, [data, series, width, height, hasData]);

  if (!hasData || !hasAnyValue) {
    return (
      <div
        ref={container}
        className="flex items-center justify-center rounded-card border border-dashed border-line bg-surface px-4 text-center"
        style={{ height }}
      >
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
      </div>
    );
  }

  const activeRow = activeIndex !== null ? data[activeIndex] : null;

  const handlePointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const step = plot.innerWidth / Math.max(1, data.length - 1);
    const index = Math.round((x - PADDING.left) / step);
    setActiveIndex(Math.min(data.length - 1, Math.max(0, index)));
  };

  return (
    <div ref={container} className="relative">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {/* A legend is always present for two or more series; a single
            series is named by the card's own title instead. */}
        {series.length > 1 ? (
          <ul className="flex flex-wrap items-center gap-3">
            {plot.paths.map((item) => (
              <li key={item.key} className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-4 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => setShowTable((open) => !open)}
          aria-expanded={showTable}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
        >
          <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
          {showTable ? "Hide data" : "View data"}
        </button>
      </div>

      <svg
        width={width}
        height={height}
        role="img"
        aria-label={caption || "Activity over time"}
        onPointerMove={handlePointer}
        onPointerLeave={() => setActiveIndex(null)}
        className="touch-pan-y"
      >
        {/* Gridlines: solid hairlines, one step off the surface. */}
        {plot.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={plot.yAt(tick)}
              y2={plot.yAt(tick)}
              stroke={CHART.grid}
              strokeWidth="1"
            />
            <text
              x={PADDING.left - 8}
              y={plot.yAt(tick) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill={CHART.textMuted}
            >
              {formatTick(tick, plot.axisMax)}
            </text>
          </g>
        ))}

        {/* x labels: first, middle and last only - a label per day is noise. */}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1]
          .filter((index, position, all) => all.indexOf(index) === position && index >= 0)
          .map((index) => (
            <text
              key={index}
              x={plot.xAt(index)}
              y={height - 8}
              textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
              fontSize="10"
              fill={CHART.textMuted}
            >
              {formatX(data[index].day ?? data[index].x)}
            </text>
          ))}

        {/* A lone series gets a wash under it; several would muddy each other. */}
        {plot.paths.length === 1 ? (
          <path d={plot.paths[0].area} fill={plot.paths[0].color} opacity={CHART.areaOpacity} />
        ) : null}

        {plot.paths.map((item) => (
          <path
            key={item.key}
            d={item.line}
            fill="none"
            stroke={item.color}
            strokeWidth={CHART.lineWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Crosshair, snapped to the nearest x. */}
        {activeIndex !== null ? (
          <g>
            <line
              x1={plot.xAt(activeIndex)}
              x2={plot.xAt(activeIndex)}
              y1={PADDING.top}
              y2={PADDING.top + plot.innerHeight}
              stroke={CHART.axis}
              strokeWidth="1"
            />
            {plot.paths.map((item) => (
              <circle
                key={item.key}
                cx={plot.xAt(activeIndex)}
                cy={plot.yAt(data[activeIndex][item.key] || 0)}
                r={CHART.markerRadius}
                fill={item.color}
                stroke={CHART.surface}
                strokeWidth={CHART.ringWidth}
              />
            ))}
          </g>
        ) : (
          // End markers when nothing is hovered, so the latest value is
          // always findable.
          plot.paths.map((item) => {
            const [x, y] = item.points[item.points.length - 1];
            return (
              <circle
                key={item.key}
                cx={x}
                cy={y}
                r={CHART.markerRadius}
                fill={item.color}
                stroke={CHART.surface}
                strokeWidth={CHART.ringWidth}
              />
            );
          })
        )}
      </svg>

      {/* Tooltip: values lead, series names follow. */}
      {activeRow ? (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-[8.5rem] rounded-xl border border-line bg-surface p-2.5 shadow-lift"
          style={{
            left: Math.min(Math.max(plot.xAt(activeIndex) - 68, 0), Math.max(0, width - 150)),
          }}
        >
          <p className="mb-1.5 text-2xs font-bold uppercase tracking-wider text-ink-faint">
            {formatX(activeRow.day ?? activeRow.x, true)}
          </p>
          <ul className="space-y-1">
            {plot.paths.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3 shrink-0 rounded-full"
                  style={{ background: item.color }}
                />
                <span className="font-bold tabular-nums text-ink">
                  {formatValue(activeRow[item.key] || 0)}
                </span>
                <span className="truncate text-ink-muted">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showTable ? (
        <div className="lf-scroll mt-3 max-h-56 overflow-auto rounded-card border border-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-ink-soft">
                  Date
                </th>
                {series.map((item) => (
                  <th key={item.key} scope="col" className="px-3 py-2 text-right font-semibold text-ink-soft">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((row, index) => (
                <tr key={row.day ?? index}>
                  <td className="px-3 py-1.5 text-ink-muted">{formatX(row.day ?? row.x, true)}</td>
                  {series.map((item) => (
                    <td key={item.key} className="px-3 py-1.5 text-right tabular-nums text-ink-soft">
                      {formatValue(row[item.key] || 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
