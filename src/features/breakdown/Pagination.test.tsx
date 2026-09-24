import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination, visiblePages } from "./Pagination";

describe("visiblePages", () => {
  it("shows every page when there are few", () => {
    expect(visiblePages(1, 2)).toEqual([1, 2]);
  });

  it("windows around the current page and clamps at the edges", () => {
    expect(visiblePages(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(visiblePages(6, 10)).toEqual([4, 5, 6, 7, 8]);
    expect(visiblePages(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });
});

describe("Pagination", () => {
  it("summarises the visible range and disables out-of-range navigation", () => {
    render(<Pagination page={2} pageSize={5} totalRows={6} onPageChange={() => {}} />);
    expect(screen.getByText("6–6 of 6 rows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  });

  it("requests the next page", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={5} totalRows={6} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
