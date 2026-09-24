import { useId, type ReactNode } from "react";
import styles from "./Panel.module.css";

interface PanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Controls rendered on the right of the header (selects, buttons). */
  actions?: ReactNode;
  /** Shown next to the title while background data is refreshing. */
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, subtitle, actions, status, children, className }: PanelProps) {
  const titleId = useId();
  return (
    <section className={[styles.panel, className].filter(Boolean).join(" ")} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.titleRow}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {status}
          </div>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
