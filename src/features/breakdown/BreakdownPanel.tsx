import { useEffect } from "react";
import { DIMENSIONS } from "../../api/types";
import { Panel } from "../../shared/ui/Panel";
import { AsyncContent } from "../../shared/ui/AsyncContent";
import { Select } from "../../shared/ui/Select";
import { EmptyState, LoadingState, Skeleton, UpdatingIndicator } from "../../shared/ui/states";
import { describeSelection, DIMENSION_LABEL, DIMENSION_NOUN_PLURAL } from "../dashboard/labels";
import { BREAKDOWN_PAGE_SIZE } from "../dashboard/state/dashboardState";
import { useDashboard } from "../dashboard/state/useDashboard";
import {
  setBreakdownDimension,
  setBreakdownSearch,
  setPage,
  toggleFilterValue,
  toggleSort,
} from "../dashboard/state/transitions";
import { BreakdownSearch } from "./BreakdownSearch";
import { BreakdownTable } from "./BreakdownTable";
import { Pagination } from "./Pagination";
import { useBreakdown } from "./useBreakdown";
import styles from "./breakdown.module.css";

const DIMENSION_OPTIONS = DIMENSIONS.map((d) => ({ value: d, label: DIMENSION_LABEL[d] }));

export function BreakdownPanel() {
  const { state, dispatch } = useDashboard();
  const query = useBreakdown();
  const { metric, filters } = state;
  const { dimension, search, sortBy, sortOrder, page } = state.breakdown;

  // A shared URL can point past the last page once the data changes; snap back to the last real page.
  const totalRows = query.data?.totalRows;
  useEffect(() => {
    if (totalRows === undefined || query.isPlaceholderData) return;
    const lastPage = Math.max(1, Math.ceil(totalRows / BREAKDOWN_PAGE_SIZE));
    if (page > lastPage) dispatch(setPage(lastPage), "replace");
  }, [totalRows, page, query.isPlaceholderData, dispatch]);

  return (
    <Panel
      title="Breakdown"
      subtitle="Select a row to filter the dashboard"
      status={<UpdatingIndicator active={query.isFetching && query.data !== undefined} />}
      actions={
        <Select label="By" value={dimension} options={DIMENSION_OPTIONS} onChange={(d) => dispatch(setBreakdownDimension(d))} />
      }
    >
      {/* Keyed by dimension so a pending debounced search never leaks into another dimension. */}
      <BreakdownSearch
        key={dimension}
        value={search}
        placeholder={`Search ${DIMENSION_NOUN_PLURAL[dimension]}…`}
        onCommit={(value) => dispatch(setBreakdownSearch(value), "replace")}
      />

      <div className={styles.body} data-stale={query.isPlaceholderData || undefined}>
        <AsyncContent
          query={query}
          errorTitle="the breakdown"
          loading={<TableSkeleton />}
          isEmpty={(data) => data.totalRows === 0}
          empty={
            search ? (
              <EmptyState
                title={`No ${DIMENSION_NOUN_PLURAL[dimension]} match “${search}”`}
                description="Search matches any part of the name and ignores case."
                action={
                  <button type="button" className={styles.linkButton} onClick={() => dispatch(setBreakdownSearch(""))}>
                    Clear search
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="No data for these filters"
                description={`No plays recorded for ${describeSelection(filters, state.range)}. Try widening the date range.`}
              />
            )
          }
        >
          {(data) => (
            <>
              <BreakdownTable
                rows={data.rows}
                dimension={dimension}
                metric={metric}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={(field) => dispatch(toggleSort(field))}
                activeValues={filters[dimension] ?? []}
                onRowClick={(value) => dispatch(toggleFilterValue(dimension, value))}
              />
              <Pagination page={page} pageSize={BREAKDOWN_PAGE_SIZE} totalRows={data.totalRows} onPageChange={(p) => dispatch(setPage(p))} />
            </>
          )}
        </AsyncContent>
      </div>
    </Panel>
  );
}

function TableSkeleton() {
  return (
    <LoadingState label="Loading breakdown">
      <div className={styles.skeleton} aria-hidden="true">
        <Skeleton height={14} width="100%" />
        {Array.from({ length: BREAKDOWN_PAGE_SIZE }, (_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton height={12} width="30%" />
            <Skeleton height={12} width="15%" />
            <Skeleton height={12} width="15%" />
            <Skeleton height={12} width="25%" />
          </div>
        ))}
      </div>
    </LoadingState>
  );
}
