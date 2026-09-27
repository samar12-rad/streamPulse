import { DATE_PRESETS, type DatePreset, type TimeRange } from "../../api/types";
import { formatDateTime, formatWindow } from "./format";

export const HOUR_SEC = 3600;

/** How far back the API keeps data. */
export const DATA_WINDOW_DAYS = 30;

/** Shortest custom range allowed — one hourly bucket. */
export const MIN_CUSTOM_SPAN_SEC = HOUR_SEC;

/**
 * What the user picked: a rolling preset, or a fixed window (unix seconds,
 * hour-aligned, `to` exclusive) from the custom picker or a chart zoom.
 */
export type RangeSelection = DatePreset | TimeRange;

export function isPreset(range: RangeSelection): range is DatePreset {
  return typeof range === "string";
}

/** Current time floored to the hour, in unix seconds — matches the dataset's hour-aligned end. */
export function currentHourSec(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / HOUR_SEC) * HOUR_SEC;
}

export function presetDurationSec(preset: DatePreset): number {
  const match = DATE_PRESETS.find((p) => p.key === preset);
  if (!match) throw new Error(`Unknown date preset: ${preset}`);
  return match.durationSec;
}

export function presetLabel(preset: DatePreset): string {
  return DATE_PRESETS.find((p) => p.key === preset)?.label ?? preset;
}

/**
 * Snaps a custom window outward to whole hours (the dataset's resolution) and
 * enforces a minimum span. Returns null for anything that isn't a real window.
 */
export function normalizeCustomRange(from: number, to: number): TimeRange | null {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const start = Math.floor(Math.min(from, to) / HOUR_SEC) * HOUR_SEC;
  const end = Math.ceil(Math.max(from, to) / HOUR_SEC) * HOUR_SEC;
  return { from: start, to: Math.max(end, start + MIN_CUSTOM_SPAN_SEC) };
}

/** A key that is equal for equal selections — for memo dependencies. */
export function rangeKey(range: RangeSelection): string {
  return isPreset(range) ? range : `${range.from}-${range.to}`;
}

/**
 * Resolves a selection into a concrete range.
 *
 * The anchor is passed in (rather than read from the clock) so that the range —
 * and therefore every query key derived from it — stays stable across renders.
 * Reading `Date.now()` here would produce a new key on every render and trigger
 * refetch loops. Custom ranges are clamped so they never reach into the future.
 */
export function resolveRange(range: RangeSelection, anchorSec: number): TimeRange {
  if (isPreset(range)) return { from: anchorSec - presetDurationSec(range), to: anchorSec };
  const to = Math.min(range.to, anchorSec);
  return { from: Math.min(range.from, to - MIN_CUSTOM_SPAN_SEC), to };
}

/** "Last 7 days", or "Sep 20, 10:00 – 20:00" for a custom window. */
export function rangeLabel(range: RangeSelection): string {
  return isPreset(range) ? presetLabel(range) : formatWindow(range.from, range.to);
}

/** "in the last 7 days" / "between Sep 20, 10:00 and Sep 20, 20:00" — for sentences. */
export function rangePhrase(range: RangeSelection): string {
  return isPreset(range) ? `in the ${presetLabel(range).toLowerCase()}` : `between ${formatDateTime(range.from)} and ${formatDateTime(range.to)}`;
}

/**
 * A window around an incident for zooming in: padded on both sides so the
 * before/after is visible, and short enough (≤ ~26h) to get hourly buckets.
 */
export function zoomWindow(window: TimeRange, anchorSec: number): TimeRange {
  const span = window.to - window.from;
  const pad = Math.min(12, Math.max(2, Math.floor((24 * HOUR_SEC - span) / 2 / HOUR_SEC))) * HOUR_SEC;
  const range = normalizeCustomRange(window.from - pad, Math.min(anchorSec, window.to + pad));
  return range ?? window;
}
