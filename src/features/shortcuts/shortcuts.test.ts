import { describe, expect, it } from "vitest";
import { DEFAULT_STATE } from "../dashboard/state/dashboardState";
import { isTypingTarget, transitionForKey } from "./shortcuts";

const apply = (key: string, state = DEFAULT_STATE) => transitionForKey(key, state)?.(state);

describe("transitionForKey", () => {
  it("maps 1–6 to the metric cards in order", () => {
    expect(apply("1")?.metric).toBe("plays");
    expect(apply("6")?.metric).toBe("errorRate");
    expect(apply("7")).toBeUndefined();
  });

  it("toggles the comparison overlay", () => {
    expect(apply("c")?.compare).toBe(true);
    expect(apply("C", { ...DEFAULT_STATE, compare: true })?.compare).toBe(false);
  });

  it("cycles grouping through none → device → country → cdn → none", () => {
    let state = DEFAULT_STATE;
    const seen: (string | null)[] = [];
    for (let i = 0; i < 4; i += 1) {
      state = transitionForKey("g", state)?.(state) ?? state;
      seen.push(state.groupBy);
    }
    expect(seen).toEqual(["device", "country", "cdn", null]);
  });

  it("ignores unmapped keys", () => {
    expect(transitionForKey("x", DEFAULT_STATE)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is true for form fields only", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
