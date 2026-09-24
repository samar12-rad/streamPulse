import type { MetricKey } from "../../api/types";
import { computeChange, type PeriodChange } from "../../shared/lib/change";
import { formatMetric, METRIC_LABEL } from "../../shared/lib/format";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "../../shared/ui/icons";
import styles from "./summary.module.css";

interface MetricCardProps {
  metric: MetricKey;
  present: number;
  past: number;
  selected: boolean;
  onSelect: (metric: MetricKey) => void;
}

export function MetricCard({ metric, present, past, selected, onSelect }: MetricCardProps) {
  const change = computeChange(metric, present, past);

  return (
    <button
      type="button"
      className={styles.card}
      aria-pressed={selected}
      data-selected={selected || undefined}
      onClick={() => onSelect(metric)}
      title={`Show ${METRIC_LABEL[metric]} in the chart`}
    >
      <span className={styles.label}>{METRIC_LABEL[metric]}</span>
      <span className={styles.value}>{formatMetric(metric, present)}</span>
      <ChangeIndicator change={change} previous={formatMetric(metric, past)} />
    </button>
  );
}

const SENTIMENT_TEXT = { good: "better", bad: "worse", neutral: "no change" } as const;

/**
 * Communicates change through three redundant channels — arrow direction,
 * explicit "better" / "worse" wording, and colour — so it never depends on
 * colour alone.
 */
export function ChangeIndicator({ change, previous }: { change: PeriodChange; previous: string }) {
  if (change.percent === null) {
    return <span className={styles.delta}>No data for previous period</span>;
  }

  const Icon = change.direction === "up" ? ArrowUpIcon : change.direction === "down" ? ArrowDownIcon : MinusIcon;
  const magnitude = `${Math.abs(change.percent).toFixed(1)}%`;

  return (
    <span className={styles.delta}>
      <span className={styles.badge} data-sentiment={change.sentiment}>
        <Icon width={12} height={12} strokeWidth={2.5} />
        <span>
          <span className="visually-hidden">{change.direction === "up" ? "Up " : change.direction === "down" ? "Down " : ""}</span>
          {magnitude}
        </span>
        <span className={styles.sentimentText}>{SENTIMENT_TEXT[change.sentiment]}</span>
      </span>
      <span className={styles.previous}>vs {previous}</span>
    </span>
  );
}
