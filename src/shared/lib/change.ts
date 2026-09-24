import { METRIC_META, type MetricKey } from "../../api/types";

export type Direction = "up" | "down" | "flat";
export type Sentiment = "good" | "bad" | "neutral";

export interface PeriodChange {
  /** Percentage change vs. the previous period, or `null` when there is no baseline. */
  percent: number | null;
  direction: Direction;
  /** Whether the movement is an improvement, taking the metric's polarity into account. */
  sentiment: Sentiment;
}

/** Changes smaller than this (in percent) are treated as flat, so noise doesn't read as a trend. */
export const FLAT_THRESHOLD_PERCENT = 0.05;

/**
 * Period-over-period change for a metric.
 *
 * An increase is good for plays/viewers/bitrate but bad for rebuffering, startup
 * time and error rate — that polarity comes from `METRIC_META.invertedLogic`.
 * A zero baseline (e.g. the period before a 30-day range lies outside the
 * dataset) yields `percent: null` rather than `Infinity` / `NaN`.
 */
export function computeChange(metric: MetricKey, present: number, past: number): PeriodChange {
  if (!Number.isFinite(present) || !Number.isFinite(past) || past === 0) {
    return { percent: null, direction: "flat", sentiment: "neutral" };
  }

  const percent = ((present - past) / Math.abs(past)) * 100;
  if (Math.abs(percent) < FLAT_THRESHOLD_PERCENT) {
    return { percent, direction: "flat", sentiment: "neutral" };
  }

  const direction: Direction = percent > 0 ? "up" : "down";
  const higherIsBetter = !METRIC_META[metric].invertedLogic;
  const improved = (direction === "up") === higherIsBetter;
  return { percent, direction, sentiment: improved ? "good" : "bad" };
}
