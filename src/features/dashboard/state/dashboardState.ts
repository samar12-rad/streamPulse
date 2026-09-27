import {
  CDNS,
  COUNTRIES,
  DEVICES,
  DIMENSIONS,
  METRIC_KEYS,
  type BreakdownSortField,
  type DatePreset,
  type DimensionKey,
  type Filters,
  type MetricKey,
  type SortOrder,
} from "../../../api/types";
import { isPreset, normalizeCustomRange, type RangeSelection } from "../../../shared/lib/timeRange";

/**
 * Everything the user can select on the dashboard. This object is the single
 * source of truth and lives in the URL query string, so any view can be shared
 * or restored by copying the address bar.
 */
export interface DashboardState {
  /** A rolling preset, or a fixed window from the custom picker or a chart zoom. */
  range: RangeSelection;
  filters: Filters;
  /** Metric shown in the chart and the breakdown's value column. */
  metric: MetricKey;
  groupBy: DimensionKey | null;
  /** Overlay the previous period on the chart. */
  compare: boolean;
  breakdown: BreakdownState;
}

export interface BreakdownState {
  dimension: DimensionKey;
  search: string;
  sortBy: BreakdownSortField;
  sortOrder: SortOrder;
  /** 1-based, as expected by the API. */
  page: number;
}

export const BREAKDOWN_PAGE_SIZE = 5;

export const DEFAULT_STATE: DashboardState = {
  range: "last-7-days",
  filters: {},
  metric: "rebufferRatio",
  groupBy: null,
  compare: false,
  breakdown: {
    dimension: "device",
    search: "",
    sortBy: "value",
    sortOrder: "desc",
    page: 1,
  },
};

/** Allowed values per dimension, used to drop anything unknown coming from a hand-edited URL. */
const DIMENSION_VALUES: Record<DimensionKey, readonly string[]> = {
  device: DEVICES,
  country: COUNTRIES,
  cdn: CDNS,
};

/* ------------------------------------------------------------------ *
 * URL encoding
 * ------------------------------------------------------------------ */

/** Short, human-readable tokens for the range so URLs stay tidy (`?range=24h`). */
const RANGE_TOKENS: Record<DatePreset, string> = {
  "last-24-hours": "24h",
  "last-7-days": "7d",
  "last-30-days": "30d",
};

const PARAM = {
  range: "range",
  from: "from",
  to: "to",
  compare: "compare",
  metric: "metric",
  groupBy: "groupBy",
  breakdownDimension: "breakdown",
  search: "q",
  sortBy: "sort",
  sortOrder: "order",
  page: "page",
} as const;

const SORT_FIELDS: readonly BreakdownSortField[] = ["key", "value", "plays"];
const SORT_ORDERS: readonly SortOrder[] = ["asc", "desc"];

function isOneOf<T extends string>(values: readonly T[], candidate: string | null): candidate is T {
  return candidate !== null && (values as readonly string[]).includes(candidate);
}

/** Custom windows are written as UTC timestamps to the minute, e.g. `2026-09-20T10:00Z`. */
function formatUrlTime(sec: number): string {
  return `${new Date(sec * 1000).toISOString().slice(0, 16)}Z`;
}

function parseUrlTime(raw: string | null): number {
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(raw)) return Number.NaN;
  return Date.parse(raw) / 1000;
}

function parseRange(params: URLSearchParams): RangeSelection {
  // A complete, valid custom window wins over the preset token.
  const custom = normalizeCustomRange(parseUrlTime(params.get(PARAM.from)), parseUrlTime(params.get(PARAM.to)));
  if (custom) return custom;
  const token = params.get(PARAM.range);
  const match = (Object.keys(RANGE_TOKENS) as DatePreset[]).find((preset) => RANGE_TOKENS[preset] === token);
  return match ?? DEFAULT_STATE.range;
}

function parsePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * Canonical form for a filter list: known values only, de-duplicated, in the
 * same order as the dimension's value list. Canonicalising means two
 * equivalent selections always produce the same URL and the same query key.
 */
export function normalizeFilterValues(dimension: DimensionKey, values: readonly string[]): string[] {
  const selected = new Set(values);
  return DIMENSION_VALUES[dimension].filter((value) => selected.has(value));
}

export function normalizeFilters(filters: Filters): Filters {
  const result: Filters = {};
  for (const dimension of DIMENSIONS) {
    const values = normalizeFilterValues(dimension, filters[dimension] ?? []);
    if (values.length) result[dimension] = values;
  }
  return result;
}

/** Parses a query string into a fully valid state; anything malformed falls back to its default. */
export function parseDashboardState(search: string): DashboardState {
  const params = new URLSearchParams(search);

  const filters: Filters = {};
  for (const dimension of DIMENSIONS) {
    const raw = params.get(dimension);
    if (raw) filters[dimension] = raw.split(",");
  }

  const metric = params.get(PARAM.metric);
  const groupBy = params.get(PARAM.groupBy);
  const breakdownDimension = params.get(PARAM.breakdownDimension);
  const sortBy = params.get(PARAM.sortBy);
  const sortOrder = params.get(PARAM.sortOrder);

  return {
    range: parseRange(params),
    filters: normalizeFilters(filters),
    metric: isOneOf(METRIC_KEYS, metric) ? metric : DEFAULT_STATE.metric,
    groupBy: isOneOf(DIMENSIONS, groupBy) ? groupBy : null,
    compare: params.get(PARAM.compare) === "1",
    breakdown: {
      dimension: isOneOf(DIMENSIONS, breakdownDimension) ? breakdownDimension : DEFAULT_STATE.breakdown.dimension,
      search: params.get(PARAM.search) ?? "",
      sortBy: isOneOf(SORT_FIELDS, sortBy) ? sortBy : DEFAULT_STATE.breakdown.sortBy,
      sortOrder: isOneOf(SORT_ORDERS, sortOrder) ? sortOrder : DEFAULT_STATE.breakdown.sortOrder,
      page: parsePage(params.get(PARAM.page)),
    },
  };
}

/**
 * Serialises state to a query string, omitting defaults so the URL only
 * carries what the user actually changed. Output is deterministic.
 */
export function serializeDashboardState(state: DashboardState): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string, fallback: string) => {
    if (value !== fallback) params.set(key, value);
  };

  if (isPreset(state.range)) {
    set(PARAM.range, RANGE_TOKENS[state.range], RANGE_TOKENS["last-7-days"]);
  } else {
    params.set(PARAM.from, formatUrlTime(state.range.from));
    params.set(PARAM.to, formatUrlTime(state.range.to));
  }
  for (const dimension of DIMENSIONS) {
    const values = state.filters[dimension];
    if (values?.length) params.set(dimension, values.join(","));
  }
  set(PARAM.metric, state.metric, DEFAULT_STATE.metric);
  set(PARAM.groupBy, state.groupBy ?? "", "");
  if (state.compare) params.set(PARAM.compare, "1");

  const { breakdown } = state;
  const defaults = DEFAULT_STATE.breakdown;
  set(PARAM.breakdownDimension, breakdown.dimension, defaults.dimension);
  set(PARAM.search, breakdown.search, defaults.search);
  set(PARAM.sortBy, breakdown.sortBy, defaults.sortBy);
  set(PARAM.sortOrder, breakdown.sortOrder, defaults.sortOrder);
  set(PARAM.page, String(breakdown.page), String(defaults.page));

  return params.toString();
}
