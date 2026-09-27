import { DIMENSIONS, METRIC_KEYS, type DimensionKey } from "../../api/types";
import type { DashboardState } from "../dashboard/state/dashboardState";
import { setCompare, setGroupBy, setMetric, type Transition } from "../dashboard/state/transitions";

export const SEARCH_SHORTCUT_TARGET = "breakdown-search";

export const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "/", description: "Search the breakdown" },
  { keys: "1 – 6", description: "Show a metric in the chart" },
  { keys: "G", description: "Cycle chart grouping" },
  { keys: "C", description: "Toggle previous-period overlay" },
  { keys: "?", description: "Show these shortcuts" },
];

const GROUPINGS: (DimensionKey | null)[] = [null, ...DIMENSIONS];

/** Typing in a field must never trigger a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** The dashboard change for a key, if it maps to one. */
export function transitionForKey(key: string, state: DashboardState): Transition | null {
  const digit = Number(key);
  if (Number.isInteger(digit) && digit >= 1 && digit <= METRIC_KEYS.length) {
    const metric = METRIC_KEYS[digit - 1];
    return metric ? setMetric(metric) : null;
  }
  switch (key.toLowerCase()) {
    case "c":
      return setCompare(!state.compare);
    case "g": {
      const next = GROUPINGS[(GROUPINGS.indexOf(state.groupBy) + 1) % GROUPINGS.length] ?? null;
      return setGroupBy(next);
    }
    default:
      return null;
  }
}
