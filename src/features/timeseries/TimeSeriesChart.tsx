import { useMemo, useState } from "react";
import type { MouseHandlerDataParam } from "recharts";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DimensionKey, MetricKey, TimeRange, TimeSeriesResponse } from "../../api/types";
import { formatBucket, formatMetric, formatTick, METRIC_LABEL } from "../../shared/lib/format";
import { formatDimensionValue } from "../dashboard/labels";
import { useTheme } from "../theme/themeStore";
import {
  bucketCoverageSec,
  CHART_CHROME,
  dragToRange,
  isPartialBucket,
  pickTicks,
  seriesColor,
  toChartRows,
  withPrevious,
  type ChartRow,
} from "./chartData";
import styles from "./timeseries.module.css";

export interface ComparisonData {
  /** The previous period's series, or undefined while it loads or if it failed. */
  data: TimeSeriesResponse | undefined;
  /** How far to shift the previous period forward — the range's length. */
  offsetSec: number;
}

export interface HighlightWindow {
  window: TimeRange;
  label: string;
}

interface TimeSeriesChartProps {
  data: TimeSeriesResponse;
  metric: MetricKey;
  groupBy: DimensionKey | null;
  timeRange: TimeRange;
  comparison?: ComparisonData;
  /** Shaded band, e.g. a detected anomaly. */
  highlight?: HighlightWindow;
  /** Called with the dragged-over window; the chart zooms nothing by itself. */
  onZoom?: (range: TimeRange) => void;
}

/** The bucket timestamp under the pointer, from recharts' mouse-handler payload. */
function pointerTs(state: MouseHandlerDataParam, rows: readonly ChartRow[]): number | null {
  const label = Number(state.activeLabel);
  if (Number.isFinite(label)) return label;
  const index = Number(state.activeTooltipIndex);
  return Number.isInteger(index) ? (rows[index]?.ts ?? null) : null;
}

interface SeriesView {
  name: string;
  label: string;
  color: string;
}

export function TimeSeriesChart({ data, metric, groupBy, timeRange, comparison, highlight, onZoom }: TimeSeriesChartProps) {
  const { theme } = useTheme();
  const chrome = CHART_CHROME[theme];
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null);

  const previous = comparison?.data;
  const offsetSec = comparison?.offsetSec ?? 0;
  const rows = useMemo(() => {
    const current = toChartRows(data.series);
    return previous ? withPrevious(current, previous.series, offsetSec, data.granularitySec) : current;
  }, [data.series, data.granularitySec, previous, offsetSec]);
  const rowsByTs = useMemo(() => new Map(rows.map((row) => [row.ts, row])), [rows]);
  const ticks = useMemo(() => pickTicks(rows, 7), [rows]);

  const series: SeriesView[] = data.series.map((s, i) => ({
    name: s.name,
    label: groupBy ? formatDimensionValue(groupBy, s.name) : "All traffic",
    color: seriesColor(theme, groupBy, s.name, i),
  }));

  const first = rows[0]?.ts ?? 0;
  const last = rows[rows.length - 1]?.ts ?? 0;
  const spanSec = last - first + data.granularitySec;

  // Shade the segments leading into a partial first/last bucket so a partial
  // day is not mistaken for a real drop.
  const partialAreas: { x1: number; x2: number }[] = [];
  const [firstRow, secondRow] = rows;
  const lastRow = rows[rows.length - 1];
  const beforeLastRow = rows[rows.length - 2];
  if (firstRow && secondRow && isPartialBucket(firstRow.ts, data.granularitySec, timeRange)) {
    partialAreas.push({ x1: firstRow.ts, x2: secondRow.ts });
  }
  if (lastRow && beforeLastRow && isPartialBucket(lastRow.ts, data.granularitySec, timeRange)) {
    partialAreas.push({ x1: beforeLastRow.ts, x2: lastRow.ts });
  }

  const toggleSeries = (name: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      // Keep at least one series visible — an empty plot reads like missing data.
      else if (series.length - next.size > 1) next.add(name);
      return next;
    });

  // Clamp the highlight to the plotted domain; skip it if it's entirely outside.
  const band =
    highlight && highlight.window.to > first && highlight.window.from <= last
      ? { x1: Math.max(highlight.window.from, first), x2: Math.min(highlight.window.to, last), label: highlight.label }
      : null;

  const finishDrag = () => {
    const range = drag ? dragToRange(drag.start, drag.end, data.granularitySec) : null;
    setDrag(null);
    if (range && onZoom) onZoom(range);
  };

  return (
    <div className={styles.chartWrap}>
      <div className={styles.legend} role="group" aria-label="Series — click to show or hide">
        {series.map((s) => {
          const visible = !hidden.has(s.name);
          return (
            <button
              key={s.name}
              type="button"
              className={styles.legendItem}
              aria-pressed={visible}
              onClick={() => toggleSeries(s.name)}
              disabled={series.length === 1}
            >
              <span className={styles.swatch} style={{ background: visible ? s.color : "transparent", borderColor: s.color }} />
              {s.label}
            </button>
          );
        })}
        {comparison && (
          <span className={styles.legendNote}>
            <span className={styles.dashSwatch} aria-hidden="true" />
            Previous period
          </span>
        )}
      </div>

      <div
        className={styles.chart}
        data-zoomable={onZoom ? true : undefined}
        role="img"
        aria-label={`Line chart of ${METRIC_LABEL[metric]} over time for ${series.map((s) => s.label).join(", ")}${
          band ? `, with an anomaly highlighted: ${band.label}` : ""
        }`}
      >
        <div className={styles.chartInner}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              onMouseDown={(state) => {
                const ts = onZoom ? pointerTs(state, rows) : null;
                if (ts !== null) setDrag({ start: ts, end: ts });
              }}
              onMouseMove={(state) => {
                const ts = drag ? pointerTs(state, rows) : null;
                if (drag && ts !== null && ts !== drag.end) setDrag({ ...drag, end: ts });
              }}
              onMouseUp={finishDrag}
              onMouseLeave={() => setDrag(null)}
            >
              <CartesianGrid vertical={false} stroke={chrome.grid} />
              {band && (
                <ReferenceArea
                  x1={band.x1}
                  x2={band.x2}
                  fill={chrome.anomaly}
                  fillOpacity={1}
                  stroke={chrome.anomalyText}
                  strokeOpacity={0.35}
                  strokeDasharray="3 3"
                  label={{ value: band.label, position: "insideTopLeft", fill: chrome.anomalyText, fontSize: 10, fontWeight: 600 }}
                  ifOverflow="hidden"
                />
              )}
              {partialAreas.map((area) => (
                <ReferenceArea
                  key={area.x1}
                  x1={area.x1}
                  x2={area.x2}
                  fill={chrome.partial}
                  fillOpacity={1}
                  strokeOpacity={0}
                  label={{ value: "partial", position: "insideTop", fill: chrome.axis, fontSize: 10 }}
                  ifOverflow="hidden"
                />
              ))}
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={ticks}
                tickFormatter={(ts: number) => formatTick(ts, data.granularitySec, spanSec)}
                tick={{ fill: chrome.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: chrome.grid }}
                minTickGap={24}
              />
              <YAxis
                width={68}
                domain={[0, "auto"]}
                tickFormatter={(value: number) => formatMetric(metric, value, { short: true })}
                tick={{ fill: chrome.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: chrome.cursor }}
                isAnimationActive={false}
                content={({ active, label }) =>
                  active && typeof label === "number" ? (
                    <ChartTooltip
                      row={rowsByTs.get(label)}
                      granularitySec={data.granularitySec}
                      timeRange={timeRange}
                      metric={metric}
                      series={series.filter((s) => !hidden.has(s.name))}
                      showPrevious={comparison !== undefined}
                    />
                  ) : null
                }
              />
              {series.map((s) => (
                <Line
                  key={s.name}
                  type="monotone"
                  name={s.label}
                  dataKey={(row: ChartRow) => row.values[s.name]}
                  stroke={s.color}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0 }}
                  hide={hidden.has(s.name)}
                  isAnimationActive={false}
                />
              ))}
              {previous &&
                series.map((s) => (
                  <Line
                    key={`previous:${s.name}`}
                    type="monotone"
                    name={`${s.label} (previous period)`}
                    dataKey={(row: ChartRow) => row.previous?.[s.name]}
                    stroke={s.color}
                    strokeOpacity={0.5}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={false}
                    hide={hidden.has(s.name)}
                    isAnimationActive={false}
                  />
                ))}
              {drag && drag.start !== drag.end && (
                <ReferenceArea
                  x1={Math.min(drag.start, drag.end)}
                  x2={Math.max(drag.start, drag.end)}
                  fill={chrome.selection}
                  fillOpacity={1}
                  strokeOpacity={0}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

interface ChartTooltipProps {
  row: ChartRow | undefined;
  granularitySec: number;
  timeRange: TimeRange;
  metric: MetricKey;
  series: readonly SeriesView[];
  showPrevious: boolean;
}

function ChartTooltip({ row, granularitySec, timeRange, metric, series, showPrevious }: ChartTooltipProps) {
  if (!row) return null;
  const coveredSec = bucketCoverageSec(row.ts, granularitySec, timeRange);
  // Highest value first, so the worst (or best) offender is on top.
  const entries = series
    .map((s) => ({ ...s, value: row.values[s.name], previous: row.previous?.[s.name] }))
    .filter((e): e is SeriesView & { value: number; previous: number | undefined } => e.value !== undefined)
    .sort((a, b) => b.value - a.value);

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipTitle}>{formatBucket(row.ts, granularitySec)}</p>
      {coveredSec < granularitySec && (
        <p className={styles.tooltipNote}>
          Partial bucket — covers {Math.round(coveredSec / 3600)}h of {Math.round(granularitySec / 3600)}h
        </p>
      )}
      <ul className={styles.tooltipList}>
        {entries.map((entry) => (
          <li key={entry.name} className={styles.tooltipRow}>
            <span className={styles.swatch} style={{ background: entry.color, borderColor: entry.color }} />
            <span className={styles.tooltipName}>{entry.label}</span>
            <span className={styles.tooltipValue}>{formatMetric(metric, entry.value)}</span>
            {showPrevious && (
              <span className={styles.tooltipPrevious}>
                prev {entry.previous === undefined ? "—" : formatMetric(metric, entry.previous)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
