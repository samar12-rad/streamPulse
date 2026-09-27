import { METRIC_META, type MetricKey } from "../../api/types";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 2_050_000 → "2.05M", 773_300 → "773.3K", 950 → "950". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return integer.format(value);
}

export interface FormatOptions {
  /** Shorter output for dense contexts such as chart axes. */
  short?: boolean;
}

/**
 * Single source of truth for rendering metric values.
 *
 * Unit notes (from the mock API):
 * - `rebufferRatio` and `errorRate` are already percentages (0–100), not fractions.
 * - `startupTimeMs` is milliseconds; it reads better as seconds once ≥ 1s.
 * - `avgBitrateKbps` is kbps; it reads better as Mbps once ≥ 1000.
 */
export function formatMetric(metric: MetricKey, value: number, { short = false }: FormatOptions = {}): string {
  if (!Number.isFinite(value)) return "—";

  switch (metric) {
    case "plays":
    case "uniqueViewers":
      return formatCompact(value);
    case "avgBitrateKbps":
      return value >= 1000
        ? `${(value / 1000).toFixed(short ? 1 : 2)} Mbps`
        : `${integer.format(value)} kbps`;
    case "startupTimeMs":
      return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${integer.format(value)} ms`;
    case "rebufferRatio":
    case "errorRate":
      return `${value.toFixed(short ? 1 : METRIC_META[metric].decimals)}%`;
  }
}

/** Display names used across the UI (the API labels are a little verbose for cards). */
export const METRIC_LABEL: Record<MetricKey, string> = {
  plays: "Total Plays",
  uniqueViewers: "Unique Viewers",
  avgBitrateKbps: "Avg Bitrate",
  rebufferRatio: "Rebuffering",
  startupTimeMs: "Startup Time",
  errorRate: "Error Rate",
};

export function formatPercent(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

const DAY_SEC = 24 * 3600;

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dateOnly = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const timeOnly = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Formats a bucket start for an axis tick, choosing precision from the bucket width and span. */
export function formatTick(tsSec: number, granularitySec: number, spanSec: number): string {
  const date = new Date(tsSec * 1000);
  if (granularitySec >= DAY_SEC) return dateOnly.format(date);
  if (spanSec <= DAY_SEC) return timeOnly.format(date);
  return dateTime.format(date);
}

export function formatDateTime(tsSec: number): string {
  return dateTime.format(new Date(tsSec * 1000));
}

export function formatDate(tsSec: number): string {
  return dateOnly.format(new Date(tsSec * 1000));
}

/** "Sep 18, 18:00 – 21:00" for an intra-day bucket, "Sep 18" for a daily one. */
export function formatBucket(tsSec: number, granularitySec: number): string {
  if (granularitySec >= DAY_SEC) return formatDate(tsSec);
  return `${formatDateTime(tsSec)} – ${timeOnly.format(new Date((tsSec + granularitySec) * 1000))}`;
}

/** "Sep 20, 10:00 – 20:00" within one local day, "Sep 23, 23:30 – Sep 24, 09:30" across days. */
export function formatWindow(from: number, to: number): string {
  // The end is exclusive, so a window ending at midnight still reads as one day.
  const sameDay = formatDate(from) === formatDate(to - 1);
  return sameDay ? `${formatDateTime(from)} – ${timeOnly.format(new Date(to * 1000))}` : `${formatDateTime(from)} – ${formatDateTime(to)}`;
}

/** 36000 → "10h", 259200 → "3d". */
export function formatDuration(sec: number): string {
  const hours = Math.round(sec / 3600);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

/** 3600 → "Hourly", 10800 → "3-hour", 86400 → "Daily". */
export function formatGranularity(granularitySec: number): string {
  if (granularitySec === DAY_SEC) return "Daily";
  if (granularitySec % DAY_SEC === 0) return `${granularitySec / DAY_SEC}-day`;
  const hours = granularitySec / 3600;
  return hours === 1 ? "Hourly" : `${hours}-hour`;
}

/** e.g. "GMT+5:30" — shown next to the chart so readers know which clock the axis uses. */
export function localTimezoneLabel(): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "local time";
}
