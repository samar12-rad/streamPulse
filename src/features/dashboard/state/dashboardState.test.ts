import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, parseDashboardState, serializeDashboardState, type DashboardState } from "./dashboardState";

describe("parseDashboardState", () => {
  it("returns defaults for an empty query string (7 day range, page 1)", () => {
    expect(parseDashboardState("")).toEqual(DEFAULT_STATE);
    expect(DEFAULT_STATE.range).toBe("last-7-days");
  });

  it("parses every supported parameter", () => {
    const state = parseDashboardState(
      "?range=24h&device=SmartTV,Mobile&cdn=Fastly&metric=errorRate&groupBy=cdn&breakdown=country&q=in&sort=plays&order=asc&page=2"
    );
    expect(state).toEqual<DashboardState>({
      range: "last-24-hours",
      filters: { device: ["SmartTV", "Mobile"], cdn: ["Fastly"] },
      metric: "errorRate",
      groupBy: "cdn",
      breakdown: { dimension: "country", search: "in", sortBy: "plays", sortOrder: "asc", page: 2 },
    });
  });

  it("falls back to defaults for malformed or unknown values instead of throwing", () => {
    const state = parseDashboardState("?range=1y&metric=bogus&groupBy=planet&breakdown=x&sort=share&order=up&page=-3");
    expect(state).toEqual(DEFAULT_STATE);
  });

  it("drops unknown and duplicate filter values and orders them canonically", () => {
    const state = parseDashboardState("?device=Mobile,Toaster,SmartTV,Mobile&country=");
    expect(state.filters).toEqual({ device: ["SmartTV", "Mobile"] });
  });

  it("rejects fractional page numbers", () => {
    expect(parseDashboardState("?page=2.5").breakdown.page).toBe(1);
  });
});

describe("serializeDashboardState", () => {
  it("omits defaults so a fresh dashboard has a clean URL", () => {
    expect(serializeDashboardState(DEFAULT_STATE)).toBe("");
  });

  it("round-trips through parse", () => {
    const state: DashboardState = {
      range: "last-30-days",
      filters: { device: ["SmartTV"], country: ["IN", "JP"] },
      metric: "startupTimeMs",
      groupBy: "device",
      breakdown: { dimension: "cdn", search: "fast ly", sortBy: "key", sortOrder: "asc", page: 3 },
    };
    expect(parseDashboardState(serializeDashboardState(state))).toEqual(state);
  });

  it("produces the same URL for equivalent selections", () => {
    const a = parseDashboardState("?device=Mobile,SmartTV");
    const b = parseDashboardState("?device=SmartTV,Mobile");
    expect(serializeDashboardState(a)).toBe(serializeDashboardState(b));
  });
});
