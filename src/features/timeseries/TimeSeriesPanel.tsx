import { lazy, Suspense } from "react";
import type { DimensionKey, MetricKey, TimeRange, TimeSeriesResponse } from "../../api/types";
import { downloadCsv, toCsv } from "../../shared/lib/csv";
import { formatDate, formatGranularity, localTimezoneLabel, METRIC_LABEL } from "../../shared/lib/format";
import { AsyncContent } from "../../shared/ui/AsyncContent";
import controls from "../../shared/ui/controls.module.css";
import { isPreset, normalizeCustomRange } from "../../shared/lib/timeRange";
import { CompareIcon, DownloadIcon } from "../../shared/ui/icons";
import { Panel } from "../../shared/ui/Panel";
import { Select, type SelectOption } from "../../shared/ui/Select";
import { EmptyState, LoadingState, Skeleton, UpdatingIndicator } from "../../shared/ui/states";
import { describeSelection, DIMENSION_LABEL } from "../dashboard/labels";
import { pathLabel } from "../anomaly/format";
import { useIncident } from "../anomaly/useIncident";
import { DEFAULT_STATE } from "../dashboard/state/dashboardState";
import { useDashboard } from "../dashboard/state/useDashboard";
import { setCompare, setGroupBy, setRange } from "../dashboard/state/transitions";
import { hasAnyPoints, toChartRows } from "./chartData";
import type { ComparisonData, HighlightWindow } from "./TimeSeriesChart";
import { usePreviousTimeSeries, useTimeSeries } from "./useTimeSeries";
import styles from "./timeseries.module.css";

// Recharts is most of the bundle, so the chart is split out. The import starts
// right away — in parallel with the first data request rather than after it —
// so the header, cards and skeletons paint without waiting for it.
const chartModule = import("./TimeSeriesChart");
const TimeSeriesChart = lazy(() => chartModule.then((m) => ({ default: m.TimeSeriesChart })));

type GroupByOption = DimensionKey | "none";

const GROUP_BY_OPTIONS: SelectOption<GroupByOption>[] = [
  { value: "none", label: "None" },
  { value: "device", label: DIMENSION_LABEL.device },
  { value: "country", label: DIMENSION_LABEL.country },
  { value: "cdn", label: DIMENSION_LABEL.cdn },
];

export function TimeSeriesPanel() {
  const { state, timeRange, dispatch } = useDashboard();
  const query = useTimeSeries();
  const previous = usePreviousTimeSeries();
  const incident = useIncident().data;
  const { metric, groupBy, compare } = state;
  const data = query.data;
  const zoomed = !isPreset(state.range);

  const comparison: ComparisonData | undefined = compare ? { data: previous.query.data, offsetSec: previous.offsetSec } : undefined;
  const highlight: HighlightWindow | undefined =
    incident?.inRange ? { window: incident.window, label: `Anomaly · ${pathLabel(incident)}` } : undefined;

  const zoom = (range: TimeRange) => {
    const next = normalizeCustomRange(Math.max(range.from, timeRange.from), Math.min(range.to, timeRange.to));
    if (next) dispatch(setRange(next));
  };

  const subtitle = data
    ? `${formatGranularity(data.granularitySec)} buckets · ${formatDate(timeRange.from)} – ${formatDate(timeRange.to - 1)} · ${localTimezoneLabel()} · drag to zoom`
    :" ";

  return (
    <Panel
      title={`${METRIC_LABEL[metric]} over time`}
      subtitle={subtitle}
      status={<UpdatingIndicator active={query.isFetching && query.data !== undefined} />}
      actions={
        <>
          <Select
            label="Group by"
            value={groupBy ?? "none"}
            options={GROUP_BY_OPTIONS}
            active={groupBy !== null}
            onChange={(value) => dispatch(setGroupBy(value === "none" ? null : value))}
          />
          <button
            type="button"
            className={controls.button}
            data-active={compare || undefined}
            aria-pressed={compare}
            onClick={() => dispatch(setCompare(!compare))}
            title="Overlay the previous period (C)"
          >
            <CompareIcon width={14} height={14} />
            Compare
          </button>
          {zoomed && (
            <button
              type="button"
              className={controls.button}
              onClick={() => dispatch(setRange(DEFAULT_STATE.range))}
              title="Back to the last 7 days"
            >
              Reset zoom
            </button>
          )}
          <button
            type="button"
            className={controls.iconButton}
            onClick={() => data && exportCsv(data, metric)}
            disabled={!data || !hasAnyPoints(data.series)}
            aria-label="Download chart data as CSV"
            title="Download chart data as CSV"
          >
            <DownloadIcon />
          </button>
        </>
      }
    >
      <div className={styles.body} data-stale={query.isPlaceholderData || undefined}>
        {compare && <ComparisonStatus query={previous.query} />}
        <AsyncContent
          query={query}
          errorTitle="this chart"
          loading={<ChartSkeleton />}
          isEmpty={(d) => !hasAnyPoints(d.series)}
          empty={
            <EmptyState
              title="No data for these filters"
              description={`No plays recorded for ${describeSelection(state.filters, state.range)}. Try widening the date range.`}
            />
          }
        >
          {/* Keyed by grouping so legend visibility resets when the set of series changes. */}
          {(d) => (
            <Suspense fallback={<ChartSkeleton />}>
              <TimeSeriesChart
                key={groupBy ?? "none"}
                data={d}
                metric={metric}
                groupBy={groupBy}
                timeRange={timeRange}
                comparison={comparison}
                highlight={highlight}
                onZoom={zoom}
              />
            </Suspense>
          )}
        </AsyncContent>
      </div>
    </Panel>
  );
}

/** The overlay is secondary: its states are a single line, and never replace the chart. */
function ComparisonStatus({ query }: { query: ReturnType<typeof usePreviousTimeSeries>["query"] }) {
  if (query.isFetching && !query.data) return <p className={styles.compareNote}>Loading previous period…</p>;
  if (query.isError) {
    return (
      <p className={styles.compareNote} role="alert">
        Previous period failed to load.{" "}
        <button type="button" className={styles.linkButton} onClick={() => void query.refetch()}>
          Retry
        </button>
      </p>
    );
  }
  if (query.data && !hasAnyPoints(query.data.series)) {
    return <p className={styles.compareNote}>No data for the previous period — it starts before the data does.</p>;
  }
  return null;
}

function exportCsv(data: TimeSeriesResponse, metric: MetricKey) {
  const rows = toChartRows(data.series);
  const names = data.series.map((s) => s.name);
  const csv = toCsv(
    ["bucket_start_utc", ...names],
    rows.map((row) => [new Date(row.ts * 1000).toISOString(), ...names.map((name) => row.values[name] ?? "")])
  );
  downloadCsv(`streampulse-${metric}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

const SKELETON_BARS = [38, 52, 44, 66, 58, 74, 62, 80, 56, 70];

function ChartSkeleton() {
  return (
    <LoadingState label="Loading chart">
      <div className={styles.skeleton} aria-hidden="true">
        <Skeleton width={140} height={12} />
        <div className={styles.skeletonBars}>
          {SKELETON_BARS.map((height, i) => (
            <Skeleton key={i} height={`${height}%`} className={styles.skeletonBar} />
          ))}
        </div>
      </div>
    </LoadingState>
  );
}
