import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchSummary } from "../../api/mock-api";
import { useDashboard } from "../dashboard/state/useDashboard";

export function useSummary() {
  const { state, timeRange } = useDashboard();
  const { filters } = state;

  return useQuery({
    queryKey: ["summary", timeRange, filters] as const,
    queryFn: ({ signal }) => fetchSummary({ range: timeRange, filters, signal }),
    placeholderData: keepPreviousData,
  });
}
