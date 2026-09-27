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
      compare: false,
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

  it("parses a custom window, snapping it outward to whole hours", () => {
    const state = parseDashboardState("?from=2026-09-20T10:30Z&to=2026-09-20T19:10Z&range=24h");
    expect(state.range).toEqual({ from: Date.parse("2026-09-20T10:00Z") / 1000, to: Date.parse("2026-09-20T20:00Z") / 1000 });
  });

  it("ignores an incomplete or malformed custom window", () => {
    expect(parseDashboardState("?from=2026-09-20T10:00Z").range).toBe("last-7-days");
    expect(parseDashboardState("?from=yesterday&to=today&range=30d").range).toBe("last-30-days");
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
      compare: true,
      breakdown: { dimension: "cdn", search: "fast ly", sortBy: "key", sortOrder: "asc", page: 3 },
    };
    expect(parseDashboardState(serializeDashboardState(state))).toEqual(state);
  });

  it("round-trips a custom window and the compare flag", () => {
    const from = Date.parse("2026-09-20T06:00Z") / 1000;
    const state: DashboardState = { ...DEFAULT_STATE, range: { from, to: from + 22 * 3600 }, compare: true };
    const query = serializeDashboardState(state);
    expect(query).toBe("from=2026-09-20T06%3A00Z&to=2026-09-21T04%3A00Z&compare=1");
    expect(parseDashboardState(query)).toEqual(state);
  });

  it("produces the same URL for equivalent selections", () => {
    const a = parseDashboardState("?device=Mobile,SmartTV");
    const b = parseDashboardState("?device=SmartTV,Mobile");
    expect(serializeDashboardState(a)).toBe(serializeDashboardState(b));
  });
});
