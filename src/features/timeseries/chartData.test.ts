import { describe, expect, it } from "vitest";
import { bucketCoverageSec, dragToRange, isPartialBucket, pickTicks, seriesColor, toChartRows, withPrevious } from "./chartData";

describe("toChartRows", () => {
  it("pivots series into one row per timestamp, sorted, leaving gaps for missing points", () => {
    const rows = toChartRows([
      { name: "Akamai", points: [{ ts: 20, value: 2 }, { ts: 10, value: 1 }] },
      { name: "Fastly", points: [{ ts: 20, value: 5 }] },
    ]);
    expect(rows).toEqual([
      { ts: 10, values: { Akamai: 1 } },
      { ts: 20, values: { Akamai: 2, Fastly: 5 } },
    ]);
  });
});

describe("pickTicks", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ ts: i * 100, values: {} }));

  it("returns evenly spaced bucket timestamps including both ends", () => {
    expect(pickTicks(rows, 4)).toEqual([0, 300, 600, 900]);
  });

  it("returns every timestamp when there are fewer rows than ticks", () => {
    expect(pickTicks(rows.slice(0, 3), 7)).toEqual([0, 100, 200]);
  });
});

describe("partial buckets", () => {
  const DAY = 86_400;
  const range = { from: 5 * 3600, to: 3 * DAY + 6 * 3600 }; // starts 05:00, ends 06:00

  it("measures how much of a bucket falls inside the range", () => {
    expect(bucketCoverageSec(0, DAY, range)).toBe(19 * 3600);
    expect(bucketCoverageSec(DAY, DAY, range)).toBe(DAY);
    expect(bucketCoverageSec(3 * DAY, DAY, range)).toBe(6 * 3600);
  });

  it("flags only the edge buckets as partial", () => {
    expect([0, 1, 2, 3].map((d) => isPartialBucket(d * DAY, DAY, range))).toEqual([true, false, false, true]);
  });
});

describe("seriesColor", () => {
  it("keeps a dimension value's colour stable regardless of series order", () => {
    const first = seriesColor("light", "cdn", "Fastly", 0);
    const later = seriesColor("light", "cdn", "Fastly", 2);
    expect(first).toBe(later);
    expect(seriesColor("light", "cdn", "Akamai", 0)).not.toBe(first);
  });
});

describe("withPrevious", () => {
  const H = 3600;
  const rows = toChartRows([{ name: "All", points: [0, 3, 6].map((h) => ({ ts: h * H, value: 1 })) }]);

  it("shifts the previous period onto the current buckets", () => {
    const previous = [{ name: "All", points: [-9, -6, -3].map((h) => ({ ts: h * H, value: h })) }];
    const merged = withPrevious(rows, previous, 9 * H, 3 * H);
    expect(merged.map((r) => r.previous?.All)).toEqual([-9, -6, -3]);
    expect(merged.map((r) => r.values.All)).toEqual([1, 1, 1]);
  });

  it("snaps to the nearest bucket when the range isn't a whole number of buckets", () => {
    const previous = [{ name: "All", points: [{ ts: -10 * H, value: 7 }] }];
    expect(withPrevious(rows, previous, 13 * H, 3 * H)[1]?.previous?.All).toBe(7);
  });

  it("drops points that fall outside the current rows", () => {
    const previous = [{ name: "All", points: [{ ts: -30 * H, value: 7 }] }];
    expect(withPrevious(rows, previous, 9 * H, 3 * H).every((r) => r.previous?.All === undefined)).toBe(true);
  });
});

describe("dragToRange", () => {
  it("covers both end buckets whole, in either drag direction", () => {
    expect(dragToRange(600, 200, 100)).toEqual({ from: 200, to: 700 });
    expect(dragToRange(200, 600, 100)).toEqual({ from: 200, to: 700 });
  });

  it("treats a click without a drag as no zoom", () => {
    expect(dragToRange(200, 200, 100)).toBeNull();
  });
});
