import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "../dashboard/state/useDashboard";
import { detectIncident, detectionMetric } from "./investigate";

/**
 * Runs the anomaly scan for the current range, filters and metric. Shared by
 * the banner and the chart (which shades the window) — one scan, cached.
 */
export function useIncident() {
  const { state, timeRange, anchorSec } = useDashboard();
  const metric = detectionMetric(state.metric);
  const { filters } = state;

  return useQuery({
    queryKey: ["incident", timeRange, anchorSec, metric, filters] as const,
    queryFn: ({ signal }) => detectIncident({ range: timeRange, dataEndSec: anchorSec, metric, filters, signal }),
    // The data for a closed range never changes, so neither does the verdict.
    staleTime: Infinity,
  });
}
