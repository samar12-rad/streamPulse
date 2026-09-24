import type { BreakdownRow, BreakdownSortField, DimensionKey, MetricKey, SortOrder } from "../../api/types";
import { formatCompact, formatMetric, formatPercent, METRIC_LABEL } from "../../shared/lib/format";
import { ArrowDownIcon, ArrowUpIcon, FilterIcon, SortIcon } from "../../shared/ui/icons";
import { DIMENSION_LABEL, formatDimensionValue } from "../dashboard/labels";
import styles from "./breakdown.module.css";

interface BreakdownTableProps {
  rows: readonly BreakdownRow[];
  dimension: DimensionKey;
  metric: MetricKey;
  sortBy: BreakdownSortField;
  sortOrder: SortOrder;
  onSort: (field: BreakdownSortField) => void;
  /** Values of `dimension` that are currently active filters. */
  activeValues: readonly string[];
  onRowClick: (value: string) => void;
}

export function BreakdownTable({ rows, dimension, metric, sortBy, sortOrder, onSort, activeValues, onRowClick }: BreakdownTableProps) {
  // When the selected metric *is* plays, a second Plays column would just repeat it.
  const showPlays = metric !== "plays";
  const sortProps = { sortBy, sortOrder, onSort };

  return (
    <table className={styles.table}>
      <caption className="visually-hidden">
        {METRIC_LABEL[metric]} by {DIMENSION_LABEL[dimension]}. Select a row to filter the dashboard by it.
      </caption>
      <thead>
        <tr>
          <SortableHeader field="key" label={DIMENSION_LABEL[dimension]} align="start" {...sortProps} />
          <SortableHeader field="value" label={METRIC_LABEL[metric]} {...sortProps} />
          {showPlays && <SortableHeader field="plays" label="Plays" {...sortProps} />}
          <th scope="col" className={styles.shareHeader}>
            Share of plays
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const active = activeValues.includes(row.key);
          const label = formatDimensionValue(dimension, row.key);
          return (
            <tr
              key={row.key}
              className={styles.row}
              data-active={active || undefined}
              onClick={() => onRowClick(row.key)}
              title={active ? `Remove ${label} filter` : `Filter dashboard by ${label}`}
            >
              <th scope="row" className={styles.keyCell}>
                {/* The button makes the row keyboard-operable; its click bubbles to the row handler. */}
                <button type="button" className={styles.rowButton} aria-pressed={active}>
                  {label}
                  {active && <FilterIcon className={styles.activeIcon} width={12} height={12} />}
                </button>
              </th>
              <td className={styles.num}>{formatMetric(metric, row.value)}</td>
              {showPlays && <td className={styles.num}>{formatCompact(row.plays)}</td>}
              <td>
                <div className={styles.shareCell}>
                  <span className={styles.shareBar} aria-hidden="true">
                    <span style={{ width: `${Math.min(100, row.share * 100)}%` }} />
                  </span>
                  <span className={styles.shareValue}>{formatPercent(row.share)}</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface SortableHeaderProps {
  field: BreakdownSortField;
  label: string;
  sortBy: BreakdownSortField;
  sortOrder: SortOrder;
  onSort: (field: BreakdownSortField) => void;
  align?: "start" | "end";
}

function SortableHeader({ field, label, sortBy, sortOrder, onSort, align = "end" }: SortableHeaderProps) {
  const active = sortBy === field;
  const Icon = !active ? SortIcon : sortOrder === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <th
      scope="col"
      aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
      className={align === "start" ? undefined : styles.numHeader}
    >
      <button type="button" className={styles.sortButton} data-active={active || undefined} onClick={() => onSort(field)}>
        {label}
        <Icon width={12} height={12} />
      </button>
    </th>
  );
}
