import { useQuery } from "@tanstack/react-query";
import { fetchTimeSeries } from "../../api/mock-api";
import { useDashboard } from "../dashboard/state/useDashboard";

export function useTimeSeries() {
  const { state, timeRange } = useDashboard();
  const { metric, groupBy, filters } = state;

  return useQuery({
    queryKey: ["timeseries", timeRange, metric, groupBy, filters] as const,
    queryFn: ({ signal }) => fetchTimeSeries({ range: timeRange, metric, groupBy, filters, signal }),
    // Keep showing the previous chart while a new one loads, but only if its
    // series have the same meaning. After a grouping change the old series
    // ("Mobile", "Tablet") would be mislabelled, so a skeleton is shown instead.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[3] === groupBy ? previous : undefined),
  });
}
