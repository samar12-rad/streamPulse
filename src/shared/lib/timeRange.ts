import { DATE_PRESETS, type DatePreset, type TimeRange } from "../../api/types";

const HOUR_SEC = 3600;

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
 * Resolves a preset into a concrete range ending at `anchorSec`.
 *
 * The anchor is passed in (rather than read from the clock) so that the range —
 * and therefore every query key derived from it — stays referentially stable
 * across renders. Reading `Date.now()` here would produce a new key on every
 * render and trigger refetch loops.
 */
export function resolveRange(preset: DatePreset, anchorSec: number): TimeRange {
  return { from: anchorSec - presetDurationSec(preset), to: anchorSec };
}
