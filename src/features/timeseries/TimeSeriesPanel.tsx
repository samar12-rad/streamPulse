import type { DimensionKey, MetricKey, TimeSeriesResponse } from "../../api/types";
import { downloadCsv, toCsv } from "../../shared/lib/csv";
import { formatDate, formatGranularity, localTimezoneLabel, METRIC_LABEL } from "../../shared/lib/format";
import { AsyncContent } from "../../shared/ui/AsyncContent";
import controls from "../../shared/ui/controls.module.css";
import { DownloadIcon } from "../../shared/ui/icons";
import { Panel } from "../../shared/ui/Panel";
import { Select, type SelectOption } from "../../shared/ui/Select";
import { EmptyState, LoadingState, Skeleton, UpdatingIndicator } from "../../shared/ui/states";
import { describeSelection, DIMENSION_LABEL } from "../dashboard/labels";
import { useDashboard } from "../dashboard/state/useDashboard";
import { setGroupBy } from "../dashboard/state/transitions";
import { hasAnyPoints, toChartRows } from "./chartData";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { useTimeSeries } from "./useTimeSeries";
import styles from "./timeseries.module.css";

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
  const { metric, groupBy } = state;
  const data = query.data;

  const subtitle = data
    ? `${formatGranularity(data.granularitySec)} buckets · ${formatDate(timeRange.from)} – ${formatDate(timeRange.to - 1)} · ${localTimezoneLabel()}`
    : " ";

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
          {(d) => <TimeSeriesChart key={groupBy ?? "none"} data={d} metric={metric} groupBy={groupBy} timeRange={timeRange} />}
        </AsyncContent>
      </div>
    </Panel>
  );
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
