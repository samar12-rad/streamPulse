import { useState } from "react";
import { METRIC_LABEL, formatCompact, formatDuration, formatMetric, formatPercent, formatWindow } from "../../shared/lib/format";
import { computeChange } from "../../shared/lib/change";
import { rangePhrase, zoomWindow } from "../../shared/lib/timeRange";
import { describeError } from "../../shared/api/errors";
import { AlertIcon, CheckCircleIcon, CloseIcon, ZoomInIcon } from "../../shared/ui/icons";
import type { DashboardState } from "../dashboard/state/dashboardState";
import { useDashboard } from "../dashboard/state/useDashboard";
import {
  compose,
  setBreakdownDimension,
  setFilters,
  setGroupBy,
  setMetric,
  setRange,
  type Transition,
} from "../dashboard/state/transitions";
import { ChangeIndicator } from "../summary/MetricCard";
import { badDirection } from "./detect";
import { detectionMetric, QUALITY_METRICS, type Incident } from "./investigate";
import { pathLabel } from "./format";
import { useIncident } from "./useIncident";
import styles from "./anomaly.module.css";

function incidentId(incident: Incident): string {
  return `${incident.metric}|${incident.path.map((s) => s.value).join("+")}|${incident.window.from}`;
}

/**
 * Filters to every step of the path but the last, and groups the chart and
 * breakdown by the last — so the culprit is shown next to its healthy siblings
 * (Fastly spiking while Akamai and CloudFront stay flat), which is the evidence.
 */
function investigate(incident: Incident, state: DashboardState): Transition | null {
  const last = incident.path[incident.path.length - 1];
  if (!last) return null;
  const filters = { ...state.filters };
  for (const step of incident.path.slice(0, -1)) filters[step.dimension] = [step.value];
  return compose(setFilters(filters), setGroupBy(last.dimension), setBreakdownDimension(last.dimension), setMetric(incident.metric));
}

function isInvestigating(incident: Incident, state: DashboardState): boolean {
  const last = incident.path[incident.path.length - 1];
  return (
    last !== undefined &&
    state.groupBy === last.dimension &&
    incident.path.slice(0, -1).every((step) => state.filters[step.dimension]?.join() === step.value)
  );
}

/** Surfaces what went wrong and who was affected, above the metric cards. */
export function AnomalyBanner() {
  const { state, anchorSec, dispatch } = useDashboard();
  const query = useIncident();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const metricLabel = METRIC_LABEL[detectionMetric(state.metric)];

  if (query.isPending || (query.isFetching && query.isError)) {
    return (
      <p className={styles.note} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        Scanning {metricLabel.toLowerCase()} for anomalies…
      </p>
    );
  }

  if (query.isError) {
    return (
      <p className={styles.note} role="alert">
        <AlertIcon width={14} height={14} className={styles.noteAlert} />
        Anomaly scan failed: {describeError(query.error)}
        <button type="button" className={styles.linkButton} onClick={() => void query.refetch()}>
          Retry
        </button>
      </p>
    );
  }

  const incident = query.data;
  const zoomTo = (i: Incident) => dispatch(setRange(zoomWindow(i.window, anchorSec)));

  if (!incident || !incident.inRange) {
    return (
      <p className={styles.note} role="status">
        <CheckCircleIcon width={14} height={14} className={styles.noteOk} />
        No {metricLabel.toLowerCase()} anomalies {rangePhrase(state.range)}.
        {incident && (
          <>
            {" "}
            Most recent: {pathLabel(incident)}, {formatWindow(incident.window.from, incident.window.to)}.
            <button type="button" className={styles.linkButton} onClick={() => zoomTo(incident)}>
              Show it
            </button>
          </>
        )}
      </p>
    );
  }

  if (dismissed === incidentId(incident)) return null;

  const { metric, window, during, before } = incident;
  const worse = badDirection(metric) === 1 ? "spike" : "drop";
  const drillDown = isInvestigating(incident, state) ? null : investigate(incident, state);
  const share = incident.scopePlays ? during.plays / incident.scopePlays : 0;
  const duration = formatDuration(window.to - window.from);

  return (
    <section className={styles.banner} aria-labelledby="incident-title">
      <AlertIcon className={styles.icon} width={20} height={20} />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Anomaly detected</p>
        <h2 id="incident-title" className={styles.title}>
          {METRIC_LABEL[metric]} {worse} on <strong>{pathLabel(incident)}</strong>
        </h2>
        <p className={styles.meta}>
          {formatWindow(window.from, window.to)} · {duration} · <strong>{formatCompact(during.plays)} plays affected</strong> (
          {formatPercent(share)} of plays in that window)
        </p>
        <ul className={styles.metrics} aria-label={`Impact compared with the ${duration} before`}>
          {QUALITY_METRICS.map((m) => (
            <li key={m} className={styles.metric}>
              <span className={styles.metricLabel}>{METRIC_LABEL[m]}</span>
              <span className={styles.metricValue}>{formatMetric(m, during[m])}</span>
              <ChangeIndicator change={computeChange(m, during[m], before[m])} previous={formatMetric(m, before[m])} />
            </li>
          ))}
        </ul>
        <p className={styles.method}>
          Found by comparing every device, country and CDN against its own robust trend, then narrowing while the
          anomaly stays concentrated in a single value. Changes are against the {duration} before.
        </p>
      </div>
      <div className={styles.actions}>
        {drillDown && (
          <button type="button" className={styles.primary} onClick={() => dispatch(drillDown)}>
            Investigate
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={() => zoomTo(incident)}>
          <ZoomInIcon width={14} height={14} />
          Zoom to incident
        </button>
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => setDismissed(incidentId(incident))}
          aria-label="Dismiss anomaly"
          title="Dismiss"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>
    </section>
  );
}
