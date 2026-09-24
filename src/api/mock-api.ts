/**
 * Mock API for the QoE Analytics assignment.
 *
 * Every call is async, has realistic latency, can be cancelled with an
 * `AbortSignal`, and fails randomly a small fraction of the time — your UI is
 * expected to handle loading, empty and error states properly.
 *
 * Set `FAILURE_RATE` to 0 while you are building if you like, but leave it at
 * the default in what you submit.
 */

import {
  aggregate,
  dimensionValue,
  granularityFor,
  selectRows,
  type RawRow,
} from "./mock-data";
import {
  ApiError,
  CDNS,
  COUNTRIES,
  DEVICES,
  METRIC_KEYS,
  type BreakdownResponse,
  type BreakdownRow,
  type BreakdownSortField,
  type DimensionKey,
  type FilterOption,
  type Filters,
  type MetricKey,
  type SortOrder,
  type SummaryResponse,
  type TimeRange,
  type TimeSeries,
  type TimeSeriesResponse,
} from "./types";

/** Fraction of requests that fail with a 500. Keep this as-is when submitting. */
export const FAILURE_RATE = 0.12;

const MIN_LATENCY_MS = 280;
const MAX_LATENCY_MS = 900;

/** Max number of series returned when grouping a chart by a dimension. */
export const MAX_SERIES = 6;

interface BaseParams {
  range: TimeRange;
  filters?: Filters;
  signal?: AbortSignal;
}

function settle<T>(produce: () => T, signal?: AbortSignal): Promise<T> {
  const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);

  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      if (Math.random() < FAILURE_RATE) {
        reject(new ApiError("Upstream query service is unavailable", 500));
        return;
      }
      try {
        resolve(produce());
      } catch (err) {
        reject(err);
      }
    }, latency);

    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const COUNTRY_LABELS: Record<string, string> = {
  US: "United States",
  IN: "India",
  GB: "United Kingdom",
  DE: "Germany",
  BR: "Brazil",
  JP: "Japan",
};

/** Distinct values for a dimension, for the filter controls. */
export function fetchDimensionValues(
  dimension: DimensionKey,
  signal?: AbortSignal
): Promise<FilterOption[]> {
  return settle(() => {
    const source =
      dimension === "device" ? DEVICES : dimension === "country" ? COUNTRIES : CDNS;
    return source.map((value) => ({
      value,
      label: dimension === "country" ? COUNTRY_LABELS[value] ?? value : value,
    }));
  }, signal);
}

/**
 * Aggregated metrics for the selected range plus the immediately preceding
 * range of the same length, for period-over-period comparison.
 */
export function fetchSummary({ range, filters = {}, signal }: BaseParams): Promise<SummaryResponse> {
  return settle(() => {
    const span = range.to - range.from;
    const previous: TimeRange = { from: range.from - span, to: range.from };
    return {
      present: aggregate(selectRows(range, filters)),
      past: aggregate(selectRows(previous, filters)),
    };
  }, signal);
}

export interface TimeSeriesParams extends BaseParams {
  metric: MetricKey;
  /** Split the chart into one series per value of this dimension. */
  groupBy?: DimensionKey | null;
}

/**
 * One time series when `groupBy` is omitted, otherwise up to `MAX_SERIES`
 * series ordered by total plays descending.
 */
export function fetchTimeSeries({
  range,
  metric,
  groupBy = null,
  filters = {},
  signal,
}: TimeSeriesParams): Promise<TimeSeriesResponse> {
  return settle(() => {
    const rows = selectRows(range, filters);
    const granularitySec = granularityFor(range);

    const groups = new Map<string, Map<number, RawRow[]>>();
    const groupPlays = new Map<string, number>();

    for (const row of rows) {
      const groupName = groupBy ? dimensionValue(row, groupBy) : "All";
      const bucket = Math.floor(row.ts / granularitySec) * granularitySec;

      let buckets = groups.get(groupName);
      if (!buckets) {
        buckets = new Map<number, RawRow[]>();
        groups.set(groupName, buckets);
      }
      const bucketRows = buckets.get(bucket);
      if (bucketRows) bucketRows.push(row);
      else buckets.set(bucket, [row]);

      groupPlays.set(groupName, (groupPlays.get(groupName) ?? 0) + row.plays);
    }

    const series: TimeSeries[] = [...groups.entries()]
      .sort((a, b) => (groupPlays.get(b[0]) ?? 0) - (groupPlays.get(a[0]) ?? 0))
      .slice(0, groupBy ? MAX_SERIES : 1)
      .map(([name, buckets]) => ({
        name,
        points: [...buckets.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([ts, bucketRows]) => ({ ts, value: aggregate(bucketRows)[metric] })),
      }));

    return { granularitySec, series };
  }, signal);
}

export interface BreakdownParams extends BaseParams {
  metric: MetricKey;
  dimension: DimensionKey;
  /** Case-insensitive substring match on the dimension value. */
  search?: string;
  sortBy?: BreakdownSortField;
  sortOrder?: SortOrder;
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

/**
 * Server-side search, sort and pagination over one dimension.
 * `totalRows` is the count BEFORE pagination — use it to render the paginator.
 */
export function fetchBreakdown({
  range,
  metric,
  dimension,
  filters = {},
  search = "",
  sortBy = "value",
  sortOrder = "desc",
  page = 1,
  pageSize = 5,
  signal,
}: BreakdownParams): Promise<BreakdownResponse> {
  return settle(() => {
    const rows = selectRows(range, filters);

    const grouped = new Map<string, RawRow[]>();
    let totalPlays = 0;
    for (const row of rows) {
      const key = dimensionValue(row, dimension);
      const list = grouped.get(key);
      if (list) list.push(row);
      else grouped.set(key, [row]);
      totalPlays += row.plays;
    }

    let result: BreakdownRow[] = [...grouped.entries()].map(([key, groupRows]) => {
      const metrics = aggregate(groupRows);
      return {
        key,
        value: metrics[metric],
        plays: metrics.plays,
        share: totalPlays ? metrics.plays / totalPlays : 0,
      };
    });

    const needle = search.trim().toLowerCase();
    if (needle) {
      result = result.filter((row) => row.key.toLowerCase().includes(needle));
    }

    const direction = sortOrder === "asc" ? 1 : -1;
    result.sort((a, b) => {
      if (sortBy === "key") return a.key.localeCompare(b.key) * direction;
      return (a[sortBy] - b[sortBy]) * direction;
    });

    const totalRows = result.length;
    const start = Math.max(0, (page - 1) * pageSize);

    return { rows: result.slice(start, start + pageSize), totalRows };
  }, signal);
}

/** Convenience re-export so a consumer can iterate metrics without a second import. */
export { METRIC_KEYS };
