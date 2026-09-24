import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorState } from "./states";

type QueryLike<T> = Pick<UseQueryResult<T>, "data" | "error" | "isError" | "isFetching" | "refetch">;

interface AsyncContentProps<T> {
  query: QueryLike<T>;
  /** Rendered on first load and while a failed request is being retried. */
  loading: ReactNode;
  /** Name of the thing that failed, e.g. "this chart". */
  errorTitle: string;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
  compact?: boolean;
  boxed?: boolean;
}

/**
 * One consistent loading → error → empty → data state machine for every panel.
 *
 * With `placeholderData: keepPreviousData`, a filter change keeps showing the
 * previous result (dimmed by the caller) instead of flashing a skeleton; only
 * the very first load, or a retry after an error, shows the loading state.
 */
export function AsyncContent<T>({ query, loading, errorTitle, isEmpty, empty, children, compact, boxed }: AsyncContentProps<T>) {
  const { data, error, isError, isFetching, refetch } = query;

  if (isError && data === undefined) {
    if (isFetching) return <>{loading}</>;
    return <ErrorState title={`Could not load ${errorTitle}`} error={error} onRetry={() => void refetch()} compact={compact} boxed={boxed} />;
  }
  if (data === undefined) return <>{loading}</>;
  if (isEmpty?.(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}
