import { describe, expect, it } from "vitest";
import { concentrated, findAnomaly, median, refineWindow, robustTrend } from "./detect";

const H = 3600;

/** A gently trending, slightly noisy series — like the dataset's QoE metrics. */
function series(length: number, value: (i: number) => number) {
  return Array.from({ length }, (_, i) => ({ ts: i * H, value: value(i) }));
}
const wobble = (i: number) => 1 + 0.04 * Math.sin(i * 1.7);

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("robustTrend", () => {
  it("recovers a linear trend despite a large outlier", () => {
    const points = series(20, (i) => (i === 10 ? 500 : 5 + 0.5 * i));
    const { slope, intercept } = robustTrend(points);
    expect(slope * H).toBeCloseTo(0.5);
    expect(intercept).toBeCloseTo(5);
  });
});

describe("findAnomaly", () => {
  it("finds a spike and the full window around it", () => {
    const points = series(56, (i) => (i >= 30 && i < 34 ? 5 : 1) * wobble(i));
    const anomaly = findAnomaly(points, H, 1);
    expect(anomaly).not.toBeNull();
    expect(anomaly?.window).toEqual({ from: 30 * H, to: 34 * H });
    expect(anomaly?.relative).toBeGreaterThan(3);
  });

  it("does not flag a steady trend, even a steep one", () => {
    expect(findAnomaly(series(30, (i) => (1.3 - 0.013 * i) * wobble(i)), H, 1)).toBeNull();
  });

  it("respects the metric's direction", () => {
    const drop = series(40, (i) => (i === 20 ? 0.3 : 1) * wobble(i));
    expect(findAnomaly(drop, H, 1)).toBeNull(); // a drop is fine for rebuffering…
    expect(findAnomaly(drop, H, -1)?.peakTs).toBe(20 * H); // …but bad for bitrate
  });

  it("ignores statistically odd but tiny changes", () => {
    expect(findAnomaly(series(40, (i) => (i === 20 ? 1.1 : 1)), H, 1)).toBeNull();
  });

  it("needs enough points to judge", () => {
    expect(findAnomaly(series(5, (i) => (i === 2 ? 9 : 1)), H, 1)).toBeNull();
  });
});

describe("concentrated", () => {
  const candidate = (key: string, relative: number) => ({
    key,
    anomaly: { window: { from: 0, to: H }, peakTs: 0, peakValue: 0, expected: 0, relative, z: 10 },
  });

  it("picks the single value that carries the anomaly", () => {
    expect(concentrated([candidate("Fastly", 4.4)])?.key).toBe("Fastly");
    expect(concentrated([candidate("Akamai", 0.3), candidate("Fastly", 4.4)])?.key).toBe("Fastly");
  });

  it("returns null when siblings are affected about equally", () => {
    expect(concentrated([candidate("US", 1.1), candidate("IN", 1.0), candidate("JP", 0.9)])).toBeNull();
    expect(concentrated([])).toBeNull();
  });
});

describe("refineWindow", () => {
  it("sharpens a coarse window to the elevated fine buckets, ignoring one noisy hour", () => {
    // Hourly points; incident at hours 10–19 (value ~5), one noisy hour at 14; baseline 1.
    const points = series(30, (i) => (i === 14 ? 12 : i >= 10 && i < 20 ? 5 : 1));
    expect(refineWindow(points, H, 1, 1, { from: 9 * H, to: 21 * H })).toEqual({ from: 10 * H, to: 20 * H });
  });

  it("returns null when nothing inside the window is worse than the baseline", () => {
    expect(refineWindow(series(10, () => 1), H, 1, 1, { from: 0, to: 10 * H })).toBeNull();
  });
});
