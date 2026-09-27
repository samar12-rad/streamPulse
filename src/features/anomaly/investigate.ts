import { fetchSummary, fetchTimeSeries } from "../../api/mock-api";
import {
  ApiError,
  DIMENSIONS,
  type DimensionKey,
  type Filters,
  type MetricKey,
  type SummaryResponse,
  type TimeRange,
  type TimeSeriesResponse,
} from "../../api/types";
import { badDirection, concentrated, findAnomaly, overlaps, refineWindow, type Candidate, type SeriesAnomaly } from "./detect";

/**
 * Automated version of the manual investigation in the README. Each round
 * charts the metric grouped by every dimension not yet pinned down, and asks:
 * is the anomaly concentrated in a single value? "Only SmartTV spikes" or
 * "only Fastly spikes" narrows the cause; "every country spikes equally" does
 * not, so country never becomes part of the path. The strongest concentrated
 * signal is added to the path, the scope narrows to it, and the next round
 * runs inside that scope until nothing narrows further.
 *
 * Then the window is sharpened at hourly resolution, and the path is
 * summarised during the window. The API's "past" period is the equal-length
 * window right before it — exactly the baseline an impact number needs.
 */

export interface PathStep {
  dimension: DimensionKey;
  value: string;
}

export interface Incident {
  metric: MetricKey;
  /** What the scan narrowed down to, in dimension order, e.g. SmartTV → Fastly. */
  path: PathStep[];
  /** The affected slice in full: the path plus any dimension the user had already pinned to one value. */
  scope: PathStep[];
  window: TimeRange;
  /** Whether the window overlaps the range the user is looking at. */
  inRange: boolean;
  anomaly: SeriesAnomaly;
  /** Metrics for the path during the window, and for the same-length window before it. */
  during: SummaryResponse["present"];
  before: SummaryResponse["past"];
  /** Plays in scope (the user's filters) during the window — the denominator for share. */
  scopePlays: number;
}

/** Too short a range has no baseline to compare against, so short views are analysed with a week of history. */
export const MIN_ANALYSIS_SEC = 7 * 24 * 3600;

/** How far past the selected range to look, so an incident running over its end isn't cut short. */
export const LOOK_AHEAD_SEC = 24 * 3600;

/** Metrics a quality incident shows up in; volume metrics swing daily and aren't scanned. */
export const QUALITY_METRICS: readonly MetricKey[] = ["rebufferRatio", "startupTimeMs", "errorRate", "avgBitrateKbps"];

export function detectionMetric(selected: MetricKey): MetricKey {
  return QUALITY_METRICS.includes(selected) ? selected : "rebufferRatio";
}

/**
 * The range the scan runs over: the selection, extended back to at least a
 * week (for a baseline) and up to a day forward, never past the end of the data.
 */
export function analysisRange(range: TimeRange, dataEndSec: number): TimeRange {
  const to = Math.max(range.to, Math.min(dataEndSec, range.to + LOOK_AHEAD_SEC));
  return { from: Math.min(range.from, to - MIN_ANALYSIS_SEC), to };
}

/**
 * The scan makes ~8 requests; with the mock's 12% failure rate, one attempt
 * each would fail more often than not. Each call gets a few attempts — this is
 * a background analysis, not a panel, so hiding a transient 500 is right here.
 * If every attempt fails the error still surfaces, with a Retry button.
 */
export async function withRetry<T>(call: () => Promise<T>, signal?: AbortSignal, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (signal?.aborted || !(error instanceof ApiError) || attempt >= attempts) throw error;
    }
  }
}

function withValue(filters: Filters, step: PathStep): Filters {
  return { ...filters, [step.dimension]: [step.value] };
}

function candidatesFrom(response: TimeSeriesResponse, dimension: DimensionKey, metric: MetricKey): Candidate<PathStep>[] {
  const direction = badDirection(metric);
  return response.series.flatMap((series) => {
    const anomaly = findAnomaly(series.points, response.granularitySec, direction);
    return anomaly ? [{ key: { dimension, value: series.name }, anomaly }] : [];
  });
}

interface DetectParams {
  range: TimeRange;
  /** End of the available data. */
  dataEndSec: number;
  metric: MetricKey;
  filters: Filters;
  signal?: AbortSignal;
}

export async function detectIncident({ range, dataEndSec, metric, filters, signal }: DetectParams): Promise<Incident | null> {
  const analysed = analysisRange(range, dataEndSec);
  const direction = badDirection(metric);
  const chart = (groupBy: DimensionKey | null, scope: Filters, over: TimeRange = analysed) =>
    withRetry(() => fetchTimeSeries({ range: over, metric, groupBy, filters: scope, signal }), signal);

  // A dimension the user already pinned to one value is a given, not a finding.
  const pinned = (d: DimensionKey) => filters[d]?.length === 1;

  const path: Candidate<PathStep>[] = [];
  let scope = filters;
  for (;;) {
    const remaining = DIMENSIONS.filter((d) => !pinned(d) && !path.some((step) => step.key.dimension === d));
    if (remaining.length === 0) break;
    const first = path[0];
    const rounds = await Promise.all(
      remaining.map(async (d) => {
        const candidates = candidatesFrom(await chart(d, scope), d, metric);
        // After the first step, only the same incident counts: windows must overlap.
        return concentrated(first ? candidates.filter((c) => overlaps(c.anomaly.window, first.anomaly.window)) : candidates);
      })
    );
    const next = rounds
      .filter((c): c is Candidate<PathStep> => c !== null)
      .sort((a, b) => b.anomaly.z - a.anomaly.z)[0];
    if (!next) break;
    path.push(next);
    scope = withValue(scope, next.key);
  }

  // Nothing concentrated: either all is well, or the whole platform is affected.
  let anomaly = path[path.length - 1]?.anomaly;
  if (!anomaly) {
    const all = await chart(null, filters);
    const [series] = all.series;
    anomaly = series ? (findAnomaly(series.points, all.granularitySec, direction) ?? undefined) : undefined;
    if (!anomaly) return null;
  }

  // Sharpen the window with finer buckets (hourly when the padded window fits in a day).
  const coarse = anomaly.window;
  const pad = Math.max(6 * 3600, Math.floor((24 * 3600 - (coarse.to - coarse.from)) / 2 / 3600) * 3600);
  const fine = await chart(null, scope, { from: coarse.from - pad, to: Math.min(coarse.to + pad, analysed.to) });
  const fineSeries = fine.series[0];
  const refined = fineSeries ? refineWindow(fineSeries.points, fine.granularitySec, direction, anomaly.expected, coarse) : null;
  const window = refined && overlaps(refined, coarse) ? refined : coarse;

  const [pathSummary, scopeSummary] = await Promise.all([
    withRetry(() => fetchSummary({ range: window, filters: scope, signal }), signal),
    withRetry(() => fetchSummary({ range: window, filters, signal }), signal),
  ]);

  const inDimensionOrder = (a: PathStep, b: PathStep) => DIMENSIONS.indexOf(a.dimension) - DIMENSIONS.indexOf(b.dimension);
  const pinnedSteps = DIMENSIONS.filter(pinned).map((dimension) => ({ dimension, value: filters[dimension]?.[0] ?? "" }));
  const found = path.map((c) => c.key);

  return {
    metric,
    path: found.sort(inDimensionOrder),
    scope: [...pinnedSteps, ...found].sort(inDimensionOrder),
    window,
    inRange: overlaps(window, range),
    anomaly,
    during: pathSummary.present,
    before: pathSummary.past,
    scopePlays: scopeSummary.present.plays,
  };
}
