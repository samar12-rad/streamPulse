import { describe, expect, it } from "vitest";
import { computeChange } from "./change";

describe("computeChange", () => {
  it("treats an increase as good for plays, viewers and bitrate", () => {
    for (const metric of ["plays", "uniqueViewers", "avgBitrateKbps"] as const) {
      expect(computeChange(metric, 110, 100)).toEqual({ percent: 10, direction: "up", sentiment: "good" });
    }
  });

  it("treats an increase as bad for rebuffering, startup time and error rate", () => {
    for (const metric of ["rebufferRatio", "startupTimeMs", "errorRate"] as const) {
      expect(computeChange(metric, 110, 100)).toMatchObject({ direction: "up", sentiment: "bad" });
      expect(computeChange(metric, 90, 100)).toMatchObject({ direction: "down", sentiment: "good" });
    }
  });

  it("returns no percentage when there is no baseline, instead of Infinity or NaN", () => {
    expect(computeChange("plays", 100, 0)).toEqual({ percent: null, direction: "flat", sentiment: "neutral" });
    expect(computeChange("plays", 0, 0).percent).toBeNull();
  });

  it("treats negligible movement as flat", () => {
    expect(computeChange("errorRate", 100.01, 100)).toMatchObject({ direction: "flat", sentiment: "neutral" });
  });
});
