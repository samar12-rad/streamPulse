import { useQuery } from "@tanstack/react-query";
import { fetchBreakdown } from "../../api/mock-api";
import { BREAKDOWN_PAGE_SIZE } from "../dashboard/state/dashboardState";
import { useDashboard } from "../dashboard/state/useDashboard";

/** Search, sort and pagination all happen server-side; every change is a new request. */
export function useBreakdown() {
  const { state, timeRange } = useDashboard();
  const { metric, filters } = state;
  const { dimension, search, sortBy, sortOrder, page } = state.breakdown;

  return useQuery({
    queryKey: ["breakdown", timeRange, metric, filters, dimension, search, sortBy, sortOrder, page] as const,
    queryFn: ({ signal }) =>
      fetchBreakdown({
        range: timeRange,
        metric,
        dimension,
        filters,
        search,
        sortBy,
        sortOrder,
        page,
        pageSize: BREAKDOWN_PAGE_SIZE,
        signal,
      }),
    // Paging/sorting keeps the old rows on screen (dimmed) to avoid layout jumps,
    // but rows for a different dimension would be wrong, so those show a skeleton.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[4] === dimension ? previous : undefined),
  });
}
