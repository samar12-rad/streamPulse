import type { DimensionKey } from "../../api/types";
import { MultiSelect } from "../../shared/ui/MultiSelect";
import { ErrorState, Skeleton } from "../../shared/ui/states";
import { DIMENSION_LABEL, formatDimensionValue } from "../dashboard/labels";
import { useDashboard } from "../dashboard/state/useDashboard";
import { setDimensionFilter } from "../dashboard/state/transitions";
import { useDimensionValues } from "./useDimensionValues";
import styles from "./filters.module.css";

export function DimensionFilter({ dimension }: { dimension: DimensionKey }) {
  const { state, dispatch } = useDashboard();
  const options = useDimensionValues(dimension);

  // Options are only needed once the popover opens, so a failed or slow request
  // never blocks the rest of the filter bar; the state is shown inside the popover.
  const placeholder = options.isError ? (
    options.isFetching ? (
      <OptionsSkeleton />
    ) : (
      <ErrorState title="Could not load options" error={options.error} onRetry={() => void options.refetch()} compact />
    )
  ) : options.isPending ? (
    <OptionsSkeleton />
  ) : undefined;

  return (
    <MultiSelect
      label={DIMENSION_LABEL[dimension]}
      selected={state.filters[dimension] ?? []}
      options={options.data}
      placeholder={placeholder}
      fallbackLabel={(value) => formatDimensionValue(dimension, value)}
      onChange={(values) => dispatch(setDimensionFilter(dimension, values))}
    />
  );
}

function OptionsSkeleton() {
  return (
    <div className={styles.optionsSkeleton} role="status">
      <span className="visually-hidden">Loading options</span>
      {[70, 55, 80, 60].map((width, i) => (
        <Skeleton key={i} width={`${width}%`} height={14} />
      ))}
    </div>
  );
}
