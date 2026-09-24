import { CDNS, COUNTRIES, DEVICES, type DimensionKey, type TimeRange, type TimeSeries } from "../../api/types";
import type { Theme } from "../theme/themeStore";

export interface ChartRow {
  ts: number;
  /** Value per series name; a missing key renders as a gap rather than a misleading zero. */
  values: Record<string, number | undefined>;
}

/** Pivots the API's series-of-points shape into the row-per-timestamp shape charts expect. */
export function toChartRows(series: readonly TimeSeries[]): ChartRow[] {
  const byTs = new Map<number, ChartRow>();
  for (const { name, points } of series) {
    for (const { ts, value } of points) {
      let row = byTs.get(ts);
      if (!row) {
        row = { ts, values: {} };
        byTs.set(ts, row);
      }
      row.values[name] = value;
    }
  }
  return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}

export function hasAnyPoints(series: readonly TimeSeries[]): boolean {
  return series.some((s) => s.points.length > 0);
}

/** Picks up to `count` evenly spaced timestamps so axis labels land on real buckets. */
export function pickTicks(rows: readonly ChartRow[], count: number): number[] {
  if (rows.length <= count) return rows.map((r) => r.ts);
  const step = (rows.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => rows[Math.round(i * step)]?.ts).filter(
    (ts): ts is number => ts !== undefined
  );
}

/**
 * Seconds of the selected range that a bucket actually covers. Buckets are
 * aligned to the granularity (e.g. UTC midnight), so the first and last bucket
 * of a range are often partial — a partial day of plays looks like a traffic
 * cliff unless it is flagged.
 */
export function bucketCoverageSec(ts: number, granularitySec: number, range: TimeRange): number {
  return Math.max(0, Math.min(ts + granularitySec, range.to) - Math.max(ts, range.from));
}

export function isPartialBucket(ts: number, granularitySec: number, range: TimeRange): boolean {
  return bucketCoverageSec(ts, granularitySec, range) < granularitySec;
}

/* ------------------------------------------------------------------ *
 * Colours
 * ------------------------------------------------------------------ */

const PALETTE: Record<Theme, readonly string[]> = {
  light: ["#2563eb", "#db2777", "#0d9488", "#ea580c", "#7c3aed", "#a16207"],
  dark: ["#5b8cff", "#f472b6", "#2dd4bf", "#fb923c", "#a78bfa", "#facc15"],
};

export const CHART_CHROME: Record<Theme, { grid: string; axis: string; cursor: string; partial: string }> = {
  light: { grid: "#e8ecf2", axis: "#8a98ad", cursor: "#cfd7e3", partial: "rgba(138, 152, 173, 0.12)" },
  dark: { grid: "#1f2b42", axis: "#6b7a93", cursor: "#2e3e5c", partial: "rgba(107, 122, 147, 0.14)" },
};

const DIMENSION_VALUES: Record<DimensionKey, readonly string[]> = {
  device: DEVICES,
  country: COUNTRIES,
  cdn: CDNS,
};

/**
 * Colour is tied to the dimension value, not the series' position, so "Fastly"
 * keeps the same colour when filters change the ranking or the set of series.
 */
export function seriesColor(theme: Theme, groupBy: DimensionKey | null, name: string, fallbackIndex: number): string {
  const palette = PALETTE[theme];
  const index = groupBy ? DIMENSION_VALUES[groupBy].indexOf(name) : 0;
  return palette[(index >= 0 ? index : fallbackIndex) % palette.length] ?? palette[0] ?? "currentColor";
}
