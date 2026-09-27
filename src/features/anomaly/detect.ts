import { METRIC_META, type MetricKey, type SeriesPoint, type TimeRange } from "../../api/types";

/**
 * Anomaly detection over one time series.
 *
 * QoE metrics drift slowly (the dataset has a month-long trend), so a plain
 * mean/σ test would flag the start or end of a long range. Instead we fit a
 * robust linear trend (Theil–Sen: median of pairwise slopes), then score each
 * bucket by its residual against the median absolute deviation of all
 * residuals. Both steps use medians, so the incident itself can't drag the
 * baseline towards it.
 *
 * A bucket is anomalous only if it is both statistically unusual (robust z)
 * and practically meaningful (relative change vs the trend) — the second
 * condition stops a very quiet series from flagging a 3% wobble.
 */

export const DETECTION = {
  /** Robust z-score a peak bucket must reach. High, because small segments are noisy. */
  minZ: 6,
  /** Relative deviation from the trend a peak bucket must reach (0.15 = 15% worse). */
  minRelative: 0.15,
  /** Looser thresholds for growing the window out from the peak. */
  extendZ: 2.5,
  extendRelative: 0.1,
  /** Too few buckets to tell an outlier from the trend. */
  minPoints: 8,
} as const;

export interface SeriesAnomaly {
  /** Anomalous buckets, as a time range (`to` exclusive). */
  window: TimeRange;
  peakTs: number;
  peakValue: number;
  /** What the trend predicts at the peak. */
  expected: number;
  /** How much worse than expected the peak is, e.g. 4.4 = 440% worse. */
  relative: number;
  z: number;
}

/** +1 when an increase is bad (rebuffering), −1 when a decrease is bad (bitrate). */
export function badDirection(metric: MetricKey): 1 | -1 {
  return METRIC_META[metric].invertedLogic ? 1 : -1;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? Number.NaN) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Theil–Sen estimator. O(n²) pairs — fine for the ≤ ~720 buckets a chart returns. */
export function robustTrend(points: readonly SeriesPoint[]): { slope: number; intercept: number } {
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i];
      const b = points[j];
      if (a && b && b.ts !== a.ts) slopes.push((b.value - a.value) / (b.ts - a.ts));
    }
  }
  const slope = slopes.length ? median(slopes) : 0;
  const intercept = median(points.map((p) => p.value - slope * p.ts));
  return { slope, intercept };
}

export function findAnomaly(
  points: readonly SeriesPoint[],
  granularitySec: number,
  direction: 1 | -1
): SeriesAnomaly | null {
  if (points.length < DETECTION.minPoints) return null;

  const { slope, intercept } = robustTrend(points);
  const expected = points.map((p) => intercept + slope * p.ts);
  const residuals = points.map((p, i) => direction * (p.value - (expected[i] ?? 0)));
  const typicalLevel = Math.abs(median(expected));
  if (!(typicalLevel > 0)) return null;

  // 1.4826 × MAD estimates σ for normal noise. The floor keeps a near-constant
  // series from turning tiny wiggles into huge z-scores.
  const sigma = Math.max(1.4826 * median(residuals.map((r) => Math.abs(r - median(residuals)))), typicalLevel * 0.01);

  const scored = points.map((p, i) => {
    const base = Math.max(Math.abs(expected[i] ?? 0), typicalLevel * 0.1);
    const residual = residuals[i] ?? 0;
    return { ts: p.ts, value: p.value, expected: expected[i] ?? 0, z: residual / sigma, relative: residual / base };
  });

  let peakIndex = -1;
  scored.forEach((s, i) => {
    if (s.z < DETECTION.minZ || s.relative < DETECTION.minRelative) return;
    if (peakIndex < 0 || s.relative > (scored[peakIndex]?.relative ?? 0)) peakIndex = i;
  });
  const peak = scored[peakIndex];
  if (!peak) return null;

  const elevated = (i: number) => {
    const s = scored[i];
    return s !== undefined && s.z >= DETECTION.extendZ && s.relative >= DETECTION.extendRelative;
  };
  let start = peakIndex;
  let end = peakIndex;
  while (elevated(start - 1)) start -= 1;
  while (elevated(end + 1)) end += 1;

  return {
    window: { from: scored[start]?.ts ?? peak.ts, to: (scored[end]?.ts ?? peak.ts) + granularitySec },
    peakTs: peak.ts,
    peakValue: peak.value,
    expected: peak.expected,
    relative: peak.relative,
    z: peak.z,
  };
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.from < b.to && b.from < a.to;
}

export interface Candidate<T> {
  key: T;
  anomaly: SeriesAnomaly;
}

/**
 * Within one dimension, is the problem concentrated in a single value? True
 * when the worst value is anomalous and every sibling is at most half as bad
 * (or not anomalous at all). "All countries are equally affected" is not a
 * useful narrowing, "only Fastly is affected" is.
 */
export function concentrated<T>(candidates: readonly Candidate<T>[]): Candidate<T> | null {
  const sorted = [...candidates].sort((a, b) => b.anomaly.relative - a.anomaly.relative);
  const [top, second] = sorted;
  if (!top) return null;
  return !second || second.anomaly.relative < top.anomaly.relative / 2 ? top : null;
}

/**
 * Sharpens a window found at coarse resolution using finer buckets. The
 * incident's typical height is the median excess of the meaningfully elevated
 * fine buckets inside the coarse window — a median, so one noisy hour can't
 * set it, and elevated ones only, since a daily bucket may be mostly normal.
 * The refined window is the contiguous run around the worst bucket that stays
 * above half that height. The baseline comes from the coarse pass — the
 * fine series is too short to estimate its own.
 */
export function refineWindow(
  points: readonly SeriesPoint[],
  granularitySec: number,
  direction: 1 | -1,
  baseline: number,
  coarse: TimeRange
): TimeRange | null {
  const excess = points.map((p) => direction * (p.value - baseline));
  const inside = points.flatMap((p, i) => (p.ts >= coarse.from && p.ts < coarse.to ? [excess[i] ?? 0] : []));
  const floor = DETECTION.extendRelative * Math.abs(baseline);
  const elevated = inside.filter((e) => e >= floor && e > 0);
  if (elevated.length === 0) return null;
  const threshold = Math.max(median(elevated) / 2, floor);

  let peak = -1;
  points.forEach((p, i) => {
    if (p.ts >= coarse.from && p.ts < coarse.to && (peak < 0 || (excess[i] ?? 0) > (excess[peak] ?? 0))) peak = i;
  });
  let start = peak;
  let end = peak;
  while ((excess[start - 1] ?? -Infinity) >= threshold) start -= 1;
  while ((excess[end + 1] ?? -Infinity) >= threshold) end += 1;
  const first = points[start];
  const last = points[end];
  return first && last ? { from: first.ts, to: last.ts + granularitySec } : null;
}
