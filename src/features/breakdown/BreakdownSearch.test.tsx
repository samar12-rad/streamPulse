import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreakdownSearch, SEARCH_DEBOUNCE_MS } from "./BreakdownSearch";

describe("BreakdownSearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

  it("commits once, 300 ms after the last keystroke", () => {
    const onCommit = vi.fn();
    render(<BreakdownSearch value="" placeholder="Search devices…" onCommit={onCommit} />);
    const input = screen.getByRole("searchbox");

    type(input, "m");
    act(() => vi.advanceTimersByTime(200));
    type(input, "mo");
    act(() => vi.advanceTimersByTime(200));
    type(input, "mob");
    expect(onCommit).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("mob");
  });

  it("commits immediately on Enter and cancels the pending commit", () => {
    const onCommit = vi.fn();
    render(<BreakdownSearch value="" placeholder="Search" onCommit={onCommit} />);
    const input = screen.getByRole("searchbox");

    type(input, "tv");
    fireEvent.keyDown(input, { key: "Enter" });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("tv");
  });

  it("adopts external changes to the committed value (e.g. browser Back)", () => {
    const { rerender } = render(<BreakdownSearch value="mob" placeholder="Search" onCommit={() => {}} />);
    rerender(<BreakdownSearch value="" placeholder="Search" onCommit={() => {}} />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});
