import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/types";
import { AsyncContent } from "./AsyncContent";

function Harness({ fetcher }: { fetcher: () => Promise<string[]> }) {
  const query = useQuery({ queryKey: ["items"], queryFn: fetcher, retry: false });
  return (
    <AsyncContent
      query={query}
      errorTitle="items"
      loading={<p>Loading…</p>}
      isEmpty={(items) => items.length === 0}
      empty={<p>Nothing here</p>}
    >
      {(items) => <p>{items.join(", ")}</p>}
    </AsyncContent>
  );
}

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("AsyncContent", () => {
  it("shows loading, then data", async () => {
    renderWithClient(<Harness fetcher={() => Promise.resolve(["a", "b"])} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByText("a, b")).toBeInTheDocument();
  });

  it("shows the empty state for empty data", async () => {
    renderWithClient(<Harness fetcher={() => Promise.resolve([])} />);
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
  });

  it("shows an error with a Retry button that refetches", async () => {
    const fetcher = vi
      .fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new ApiError("Upstream query service is unavailable", 500))
      .mockResolvedValueOnce(["recovered"]);

    renderWithClient(<Harness fetcher={fetcher} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load items");
    expect(screen.getByRole("alert")).toHaveTextContent("returned a 500");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("recovered")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
