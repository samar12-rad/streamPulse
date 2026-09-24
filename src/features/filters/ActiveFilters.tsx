import { DIMENSIONS } from "../../api/types";
import { CloseIcon } from "../../shared/ui/icons";
import { DIMENSION_LABEL, formatDimensionValue } from "../dashboard/labels";
import { useDashboard } from "../dashboard/state/useDashboard";
import { clearFilters, toggleFilterValue } from "../dashboard/state/transitions";
import styles from "./filters.module.css";

/** Removable chips for every active filter value, so the current scope is always visible. */
export function ActiveFilters() {
  const { state, dispatch } = useDashboard();

  const chips = DIMENSIONS.flatMap((dimension) =>
    (state.filters[dimension] ?? []).map((value) => ({ dimension, value }))
  );
  if (chips.length === 0) return null;

  return (
    <div className={styles.chips} aria-label="Active filters" role="group">
      {chips.map(({ dimension, value }) => {
        const text = `${DIMENSION_LABEL[dimension]}: ${formatDimensionValue(dimension, value)}`;
        return (
          <button
            key={`${dimension}:${value}`}
            type="button"
            className={styles.chip}
            onClick={() => dispatch(toggleFilterValue(dimension, value))}
            aria-label={`Remove filter ${text}`}
          >
            {text}
            <CloseIcon width={12} height={12} />
          </button>
        );
      })}
      <button type="button" className={styles.clearAll} onClick={() => dispatch(clearFilters)}>
        Clear all
      </button>
    </div>
  );
}
