/**
 * Shared types for the QoE Analytics assignment.
 * You may extend these, but do not change the shapes returned by `mock-api.ts`.
 */

export const DEVICES = ["SmartTV", "Mobile", "Desktop", "Tablet", "GameConsole"] as const;
export const COUNTRIES = ["US", "IN", "GB", "DE", "BR", "JP"] as const;
export const CDNS = ["Akamai", "CloudFront", "Fastly"] as const;

export type Device = (typeof DEVICES)[number];
export type Country = (typeof COUNTRIES)[number];
export type Cdn = (typeof CDNS)[number];

export type DimensionKey = "device" | "country" | "cdn";

export const DIMENSIONS: DimensionKey[] = ["device", "country", "cdn"];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  device: "Device Type",
  country: "Country",
  cdn: "CDN",
};

export type MetricKey =
  | "plays"
  | "uniqueViewers"
  | "avgBitrateKbps"
  | "rebufferRatio"
  | "startupTimeMs"
  | "errorRate";

export interface MetricMeta {
  key: MetricKey;
  label: string;
  /** Unit suffix to render next to the label, e.g. "kbps". Empty when unitless. */
  unit: string;
  /**
   * When true, a LOWER value is better. A period-over-period increase on such a
   * metric is a regression and must not be rendered as a positive trend.
   */
  invertedLogic: boolean;
  /** Suggested number of decimals when formatting. */
  decimals: number;
}

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  plays: { key: "plays", label: "Total Plays", unit: "", invertedLogic: false, decimals: 0 },
  uniqueViewers: { key: "uniqueViewers", label: "Unique Viewers", unit: "", invertedLogic: false, decimals: 0 },
  avgBitrateKbps: { key: "avgBitrateKbps", label: "Avg Bitrate", unit: "kbps", invertedLogic: false, decimals: 0 },
  rebufferRatio: { key: "rebufferRatio", label: "Rebuffering Ratio", unit: "%", invertedLogic: true, decimals: 2 },
  startupTimeMs: { key: "startupTimeMs", label: "Avg Startup Time", unit: "ms", invertedLogic: true, decimals: 0 },
  errorRate: { key: "errorRate", label: "Playback Error Rate", unit: "%", invertedLogic: true, decimals: 2 },
};

export const METRIC_KEYS = Object.keys(METRIC_META) as MetricKey[];

/** Unix seconds, inclusive start / exclusive end. */
export interface TimeRange {
  from: number;
  to: number;
}

export type DatePreset = "last-24-hours" | "last-7-days" | "last-30-days";

export const DATE_PRESETS: { key: DatePreset; label: string; durationSec: number }[] = [
  { key: "last-24-hours", label: "Last 24 hours", durationSec: 24 * 3600 },
  { key: "last-7-days", label: "Last 7 days", durationSec: 7 * 24 * 3600 },
  { key: "last-30-days", label: "Last 30 days", durationSec: 30 * 24 * 3600 },
];

/** Selected values per dimension. An empty / missing array means "no filter". */
export type Filters = Partial<Record<DimensionKey, string[]>>;

export interface SummaryResponse {
  /** Aggregated metrics for the selected range. */
  present: Record<MetricKey, number>;
  /** Same metrics for the immediately preceding range of equal length. */
  past: Record<MetricKey, number>;
}

export interface SeriesPoint {
  /** Bucket start, unix seconds. */
  ts: number;
  value: number;
}

export interface TimeSeries {
  /** "All" when ungrouped, otherwise the dimension value, e.g. "Akamai". */
  name: string;
  points: SeriesPoint[];
}

export interface TimeSeriesResponse {
  /** Bucket width in seconds, chosen by the server from the range span. */
  granularitySec: number;
  series: TimeSeries[];
}

export interface BreakdownRow {
  /** The dimension value, e.g. "Mobile". */
  key: string;
  /** Value of the requested metric for this dimension value. */
  value: number;
  /** Plays for this dimension value, always returned regardless of metric. */
  plays: number;
  /** This row's share of total plays in the current selection, 0..1. */
  share: number;
}

export interface BreakdownResponse {
  rows: BreakdownRow[];
  /** Total rows matching the query, before pagination. */
  totalRows: number;
}

export interface FilterOption {
  value: string;
  label: string;
}

export type SortOrder = "asc" | "desc";
export type BreakdownSortField = "key" | "value" | "plays";

/** Thrown by the mock API for simulated network / server failures. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
