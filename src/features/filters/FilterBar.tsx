import { DIMENSIONS } from "../../api/types";
import { useDashboard } from "../dashboard/state/useDashboard";
import { setRange } from "../dashboard/state/transitions";
import { DimensionFilter } from "./DimensionFilter";
import { RangePicker } from "./RangePicker";
import styles from "./filters.module.css";

export function FilterBar() {
  const { state, anchorSec, dispatch } = useDashboard();

  return (
    <div className={styles.bar} role="group" aria-label="Dashboard filters">
      <RangePicker value={state.range} anchorSec={anchorSec} onChange={(range) => dispatch(setRange(range))} />
      {DIMENSIONS.map((dimension) => (
        <DimensionFilter key={dimension} dimension={dimension} />
      ))}
    </div>
  );
}
