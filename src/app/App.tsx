import { AnomalyBanner } from "../features/anomaly/AnomalyBanner";
import { BreakdownPanel } from "../features/breakdown/BreakdownPanel";
import { ActiveFilters } from "../features/filters/ActiveFilters";
import { FilterBar } from "../features/filters/FilterBar";
import { MetricCards } from "../features/summary/MetricCards";
import { KeyboardShortcuts } from "../features/shortcuts/KeyboardShortcuts";
import { ThemeToggle } from "../features/theme/ThemeToggle";
import { TimeSeriesPanel } from "../features/timeseries/TimeSeriesPanel";
import styles from "./App.module.css";

export function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <svg viewBox="0 0 32 32" width="14" height="14">
              <path d="M5 17h5l3-7 5 13 3-6h6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className={styles.title}>StreamPulse</h1>
        </div>
        <div className={styles.toolbar}>
          <FilterBar />
          <KeyboardShortcuts />
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.main}>
        <ActiveFilters />
        <AnomalyBanner />
        <MetricCards />
        <div className={styles.panels}>
          <TimeSeriesPanel />
          <BreakdownPanel />
        </div>
      </main>
    </div>
  );
}
