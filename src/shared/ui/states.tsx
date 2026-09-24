import type { CSSProperties, ReactNode } from "react";
import { describeError } from "../api/errors";
import { AlertIcon, SearchIcon } from "./icons";
import styles from "./states.module.css";

export function Skeleton({ width, height, className }: { width?: CSSProperties["width"]; height?: CSSProperties["height"]; className?: string }) {
  return <span className={[styles.skeleton, className].filter(Boolean).join(" ")} style={{ width, height }} aria-hidden="true" />;
}

/** Wraps skeleton content so screen readers announce a single "Loading …" instead of shapes. */
export function LoadingState({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}

function messageClass(compact?: boolean, boxed?: boolean): string {
  return [styles.message, compact && styles.compact, boxed && styles.boxed].filter(Boolean).join(" ");
}

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  /** Draws its own card border, for use outside a Panel. */
  boxed?: boolean;
}

export function EmptyState({ title, description, action, compact, boxed }: EmptyStateProps) {
  return (
    <div className={messageClass(compact, boxed)} role="status">
      <SearchIcon className={styles.emptyIcon} width={22} height={22} />
      <p className={styles.messageTitle}>{title}</p>
      {description && <p className={styles.messageDescription}>{description}</p>}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  error: unknown;
  onRetry: () => void;
  compact?: boolean;
  boxed?: boolean;
}

export function ErrorState({ title, error, onRetry, compact, boxed }: ErrorStateProps) {
  return (
    <div className={messageClass(compact, boxed)} role="alert">
      <AlertIcon className={styles.errorIcon} width={22} height={22} />
      <p className={styles.messageTitle}>{title}</p>
      <p className={styles.messageDescription}>
        {describeError(error)}
        {!compact && (
          <>
            <br />
            The rest of the page is unaffected.
          </>
        )}
      </p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function UpdatingIndicator({ active }: { active: boolean }) {
  return (
    <span className={styles.updating} data-active={active} aria-live="polite">
      {active && (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          Updating…
        </>
      )}
    </span>
  );
}
