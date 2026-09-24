import { useQuery } from "@tanstack/react-query";
import { fetchDimensionValues } from "../../api/mock-api";
import type { DimensionKey } from "../../api/types";

export function useDimensionValues(dimension: DimensionKey) {
  return useQuery({
    queryKey: ["dimension-values", dimension] as const,
    queryFn: ({ signal }) => fetchDimensionValues(dimension, signal),
    // The set of devices / countries / CDNs is static for the session.
    staleTime: Infinity,
  });
}
