import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, type DashboardState } from "./dashboardState";
import {
  clearFilters,
  setBreakdownDimension,
  setBreakdownSearch,
  setDimensionFilter,
  setGroupBy,
  setMetric,
  setPage,
  setRange,
  toggleFilterValue,
  toggleSort,
  type Transition,
} from "./transitions";

const onPage3: DashboardState = {
  ...DEFAULT_STATE,
  filters: { device: ["Mobile"] },
  breakdown: { ...DEFAULT_STATE.breakdown, search: "a", page: 3 },
};

describe("page reset", () => {
  const resetting: [string, Transition][] = [
    ["range change", setRange("last-24-hours")],
    ["filter change", setDimensionFilter("cdn", ["Fastly"])],
    ["filter toggle", toggleFilterValue("device", "SmartTV")],
    ["clear filters", clearFilters],
    ["metric change", setMetric("errorRate")],
    ["breakdown dimension change", setBreakdownDimension("cdn")],
    ["search change", setBreakdownSearch("mob")],
    ["sort change", toggleSort("plays")],
  ];

  it.each(resetting)("%s sends the table back to page 1", (_, transition) => {
    expect(transition(onPage3).breakdown.page).toBe(1);
  });

  it("grouping the chart does not affect the table's page", () => {
    expect(setGroupBy("cdn")(onPage3).breakdown.page).toBe(3);
  });
});

describe("filters", () => {
  it("toggleFilterValue adds and then removes a value", () => {
    const added = toggleFilterValue("device", "SmartTV")(onPage3);
    expect(added.filters.device).toEqual(["SmartTV", "Mobile"]);
    const removed = toggleFilterValue("device", "SmartTV")(added);
    expect(removed.filters.device).toEqual(["Mobile"]);
  });

  it("removes the dimension key entirely when its last value is removed", () => {
    const state = toggleFilterValue("device", "Mobile")(onPage3);
    expect(state.filters).toEqual({});
  });

  it("ignores values that are not valid for the dimension", () => {
    expect(setDimensionFilter("cdn", ["Nope"])(DEFAULT_STATE).filters).toEqual({});
  });
});

describe("breakdown", () => {
  it("clears the search when switching dimension", () => {
    expect(setBreakdownDimension("country")(onPage3).breakdown.search).toBe("");
  });

  it("toggleSort flips direction on the active column", () => {
    const state = toggleSort("value")(DEFAULT_STATE); // default is value/desc
    expect(state.breakdown).toMatchObject({ sortBy: "value", sortOrder: "asc" });
  });

  it("toggleSort starts names A→Z and numbers highest-first", () => {
    expect(toggleSort("key")(DEFAULT_STATE).breakdown).toMatchObject({ sortBy: "key", sortOrder: "asc" });
    expect(toggleSort("plays")(DEFAULT_STATE).breakdown).toMatchObject({ sortBy: "plays", sortOrder: "desc" });
  });

  it("setPage clamps to a positive integer", () => {
    expect(setPage(0)(DEFAULT_STATE).breakdown.page).toBe(1);
    expect(setPage(2)(DEFAULT_STATE).breakdown.page).toBe(2);
  });
});

it("transitions never mutate their input", () => {
  const snapshot = structuredClone(onPage3);
  toggleFilterValue("device", "SmartTV")(onPage3);
  setBreakdownSearch("x")(onPage3);
  expect(onPage3).toEqual(snapshot);
});
