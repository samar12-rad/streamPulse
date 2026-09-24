import { METRIC_KEYS } from "../../api/types";
import { AsyncContent } from "../../shared/ui/AsyncContent";
import { EmptyState, LoadingState, Skeleton } from "../../shared/ui/states";
import { describeSelection } from "../dashboard/labels";
import { useDashboard } from "../dashboard/state/useDashboard";
import { setMetric } from "../dashboard/state/transitions";
import { MetricCard } from "./MetricCard";
import { useSummary } from "./useSummary";
import styles from "./summary.module.css";

export function MetricCards() {
  const { state, dispatch } = useDashboard();
  const summary = useSummary();

  return (
    <section aria-label="Key metrics" aria-busy={summary.isFetching}>
      <AsyncContent
        query={summary}
        errorTitle="metrics"
        compact
        boxed
        loading={<CardsSkeleton />}
        isEmpty={(data) => data.present.plays === 0}
        empty={
          <EmptyState
            compact
            boxed
            title="No plays for these filters"
            description={`Nothing was recorded for ${describeSelection(state.filters, state.range)}. Try widening the date range or removing a filter.`}
          />
        }
      >
        {({ present, past }) => (
          <div className={styles.grid} data-stale={summary.isPlaceholderData || undefined}>
            {METRIC_KEYS.map((metric) => (
              <MetricCard
                key={metric}
                metric={metric}
                present={present[metric]}
                past={past[metric]}
                selected={state.metric === metric}
                onSelect={(m) => dispatch(setMetric(m))}
              />
            ))}
          </div>
        )}
      </AsyncContent>
    </section>
  );
}

function CardsSkeleton() {
  return (
    <LoadingState label="Loading metrics">
      <div className={styles.grid}>
        {METRIC_KEYS.map((metric) => (
          <div key={metric} className={styles.card} aria-hidden="true">
            <Skeleton width="55%" height={10} />
            <Skeleton width="45%" height={26} />
            <Skeleton width="75%" height={14} />
          </div>
        ))}
      </div>
    </LoadingState>
  );
}
