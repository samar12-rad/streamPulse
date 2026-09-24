import { describe, expect, it } from "vitest";
import { bucketCoverageSec, isPartialBucket, pickTicks, seriesColor, toChartRows } from "./chartData";

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
