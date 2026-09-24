import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  it("labels a rise in rebuffering as worse in text, not only colour", () => {
    render(<MetricCard metric="rebufferRatio" present={1.3} past={1.0} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("worse")).toBeInTheDocument();
    expect(screen.getByText(/30\.0%/)).toBeInTheDocument();
    expect(screen.getByText("vs 1.00%")).toBeInTheDocument();
  });

  it("labels a rise in plays as better", () => {
    render(<MetricCard metric="plays" present={1100} past={1000} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("better")).toBeInTheDocument();
  });

  it("explains a missing baseline instead of showing Infinity%", () => {
    render(<MetricCard metric="plays" present={1100} past={0} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("No data for previous period")).toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });

  it("is a toggle button that selects its metric", async () => {
    const onSelect = vi.fn();
    render(<MetricCard metric="errorRate" present={0.5} past={0.5} selected onSelect={onSelect} />);
    const card = screen.getByRole("button", { pressed: true });
    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith("errorRate");
  });
});
