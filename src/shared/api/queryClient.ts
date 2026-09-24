import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Failures surface immediately in the affected panel, each with its own
        // Retry. Silent automatic retries would mask the mock API's failure
        // rate; in production I'd enable `retry: 1` with backoff instead.
        retry: false,
        // Aggregates for a closed hour-aligned range never change, so cached
        // results can be reused when the user toggles back to a previous view.
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
