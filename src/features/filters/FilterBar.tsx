import { DATE_PRESETS, DIMENSIONS } from "../../api/types";
import { Select } from "../../shared/ui/Select";
import { useDashboard } from "../dashboard/state/useDashboard";
import { setRange } from "../dashboard/state/transitions";
import { DimensionFilter } from "./DimensionFilter";
import styles from "./filters.module.css";

const RANGE_OPTIONS = DATE_PRESETS.map(({ key, label }) => ({ value: key, label }));

export function FilterBar() {
  const { state, dispatch } = useDashboard();

  return (
    <div className={styles.bar} role="group" aria-label="Dashboard filters">
      <Select label="Range" value={state.range} options={RANGE_OPTIONS} onChange={(range) => dispatch(setRange(range))} />
      {DIMENSIONS.map((dimension) => (
        <DimensionFilter key={dimension} dimension={dimension} />
      ))}
    </div>
  );
}
