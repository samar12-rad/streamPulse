import { createContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { TimeRange } from "../../../api/types";
import { currentHourSec, rangeKey, resolveRange } from "../../../shared/lib/timeRange";
import { parseDashboardState, type DashboardState } from "./dashboardState";
import type { Transition } from "./transitions";
import { applyTransition, canonicalizeUrl, getSearchSnapshot, subscribe, type HistoryMode } from "./urlStore";

export interface DashboardContextValue {
  state: DashboardState;
  /** Concrete unix-second range for the selection. Referentially stable per selection. */
  timeRange: TimeRange;
  /** The hour the dashboard was opened — the end of the data and of every preset. */
  anchorSec: number;
  dispatch: (transition: Transition, mode?: HistoryMode) => void;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const search = useSyncExternalStore(subscribe, getSearchSnapshot);
  const state = useMemo(() => parseDashboardState(search), [search]);

  // Ranges are anchored to the hour the dashboard was opened. The mock dataset
  // is generated once per page load and ends at that same hour, and a fixed
  // anchor keeps query keys stable (no refetch churn as the clock ticks).
  const [anchorSec] = useState(currentHourSec);
  // Keyed by value, not identity: a custom range is a fresh object on every URL parse.
  const selectionKey = rangeKey(state.range);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const timeRange = useMemo(() => resolveRange(state.range, anchorSec), [selectionKey, anchorSec]);

  useEffect(canonicalizeUrl, []);

  const value = useMemo<DashboardContextValue>(
    () => ({ state, timeRange, anchorSec, dispatch: applyTransition }),
    [state, timeRange, anchorSec]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
