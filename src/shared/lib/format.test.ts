import { describe, expect, it } from "vitest";
import { formatCompact, formatDuration, formatGranularity, formatMetric } from "./format";

describe("formatMetric", () => {
  it("formats counts compactly", () => {
    expect(formatMetric("plays", 2_051_234)).toBe("2.05M");
    expect(formatMetric("uniqueViewers", 773_312)).toBe("773.3K");
    expect(formatMetric("plays", 950)).toBe("950");
  });

  it("shows bitrate in Mbps above 1000 kbps", () => {
    expect(formatMetric("avgBitrateKbps", 4100)).toBe("4.10 Mbps");
    expect(formatMetric("avgBitrateKbps", 850)).toBe("850 kbps");
  });

  it("shows startup time in seconds above one second", () => {
    expect(formatMetric("startupTimeMs", 1850)).toBe("1.85s");
    expect(formatMetric("startupTimeMs", 640)).toBe("640 ms");
  });

  it("treats ratio metrics as already-percentages (0–100)", () => {
    expect(formatMetric("rebufferRatio", 1.1834)).toBe("1.18%");
    expect(formatMetric("errorRate", 0.5)).toBe("0.50%");
    expect(formatMetric("errorRate", 0.5, { short: true })).toBe("0.5%");
  });

  it("renders non-finite values as a dash", () => {
    expect(formatMetric("plays", Number.NaN)).toBe("—");
  });
});

describe("formatCompact", () => {
  it("handles billions", () => {
    expect(formatCompact(1_250_000_000)).toBe("1.25B");
  });
});

describe("formatGranularity", () => {
  it("names bucket sizes", () => {
    expect(formatGranularity(3600)).toBe("Hourly");
    expect(formatGranularity(3 * 3600)).toBe("3-hour");
    expect(formatGranularity(86_400)).toBe("Daily");
  });
});

describe("formatDuration", () => {
  it("uses hours up to two days, then days", () => {
    expect(formatDuration(10 * 3600)).toBe("10h");
    expect(formatDuration(47 * 3600)).toBe("47h");
    expect(formatDuration(3 * 86_400)).toBe("3d");
  });
});
