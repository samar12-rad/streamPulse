import { DIMENSIONS, type BreakdownSortField, type DimensionKey, type Filters, type MetricKey } from "../../../api/types";
import type { RangeSelection } from "../../../shared/lib/timeRange";
import { normalizeFilterValues, type DashboardState } from "./dashboardState";

/**
 * Pure state transitions. Every user action goes through one of these, which
 * keeps the business rules — most importantly "anything that changes the
 * result set sends the table back to page 1" — in one tested place instead of
 * scattered across event handlers.
 */

export type Transition = (state: DashboardState) => DashboardState;

/** Several changes as one URL update — one history entry, one set of refetches. */
export const compose =
  (...transitions: Transition[]): Transition =>
  (state) =>
    transitions.reduce((next, transition) => transition(next), state);

function firstPage(state: DashboardState): DashboardState {
  return state.breakdown.page === 1 ? state : { ...state, breakdown: { ...state.breakdown, page: 1 } };
}

/** A preset, or a custom window from the range picker or a chart zoom. */
export const setRange =
  (range: RangeSelection): Transition =>
  (state) =>
    firstPage({ ...state, range });

export const setDimensionFilter =
  (dimension: DimensionKey, values: readonly string[]): Transition =>
  (state) => {
    const normalized = normalizeFilterValues(dimension, values);
    const filters = { ...state.filters };
    if (normalized.length) filters[dimension] = normalized;
    else delete filters[dimension];
    return firstPage({ ...state, filters });
  };

/** Adds the value to the dimension's filter, or removes it if it is already selected. */
export const toggleFilterValue =
  (dimension: DimensionKey, value: string): Transition =>
  (state) => {
    const current = state.filters[dimension] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    return setDimensionFilter(dimension, next)(state);
  };

/** Replaces all filters at once, e.g. to jump to an incident's delivery path. */
export const setFilters =
  (filters: Filters): Transition =>
  (state) =>
    DIMENSIONS.reduce<DashboardState>(
      (next, dimension) => setDimensionFilter(dimension, filters[dimension] ?? [])(next),
      firstPage(state)
    );

export const clearFilters: Transition = (state) => firstPage({ ...state, filters: {} });

export const setMetric =
  (metric: MetricKey): Transition =>
  (state) =>
    // The breakdown is sorted by the metric's value by default, so the row order changes.
    firstPage({ ...state, metric });

export const setGroupBy =
  (groupBy: DimensionKey | null): Transition =>
  (state) => ({ ...state, groupBy });

export const setCompare =
  (compare: boolean): Transition =>
  (state) => ({ ...state, compare });

export const setBreakdownDimension =
  (dimension: DimensionKey): Transition =>
  (state) =>
    // A search typed for one dimension ("mob") is meaningless for another, so it is cleared.
    firstPage({ ...state, breakdown: { ...state.breakdown, dimension, search: "" } });

export const setBreakdownSearch =
  (search: string): Transition =>
  (state) =>
    firstPage({ ...state, breakdown: { ...state.breakdown, search } });

/**
 * Clicking the active column flips its direction; clicking a new column starts
 * with the most useful direction for it (A→Z for names, highest-first for numbers).
 */
export const toggleSort =
  (sortBy: BreakdownSortField): Transition =>
  (state) => {
    const { breakdown } = state;
    const sortOrder =
      breakdown.sortBy === sortBy
        ? breakdown.sortOrder === "asc"
          ? "desc"
          : "asc"
        : sortBy === "key"
          ? "asc"
          : "desc";
    return firstPage({ ...state, breakdown: { ...breakdown, sortBy, sortOrder } });
  };

export const setPage =
  (page: number): Transition =>
  (state) => ({ ...state, breakdown: { ...state.breakdown, page: Math.max(1, Math.floor(page)) } });
