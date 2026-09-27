import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/types";
import { currentHourSec } from "../../shared/lib/timeRange";
import { analysisRange, detectIncident, withRetry } from "./investigate";

const DAY = 86_400;

describe("detectIncident (against the real mock dataset)", () => {
  afterEach(() => vi.restoreAllMocks());

  it(
    "narrows the hidden incident to one delivery path and measures it",
    async () => {
      // Pin the mock's randomness: mid-range latency and no simulated failures.
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const to = currentHourSec();
      const incident = await detectIncident({ range: { from: to - 7 * DAY, to }, dataEndSec: to, metric: "rebufferRatio", filters: {} });

      expect(incident).not.toBeNull();
      if (!incident) return;
      expect(incident.path).toEqual([
        { dimension: "device", value: "SmartTV" },
        { dimension: "cdn", value: "Fastly" },
      ]);
      expect(incident.scope).toEqual(incident.path);
      expect(incident.inRange).toBe(true);
      // Found in 3-hour buckets, then sharpened to the hour: 96h → 86h before the end of the data.
      expect((to - incident.window.from) / 3600).toBe(96);
      expect((to - incident.window.to) / 3600).toBe(86);
      expect(incident.during.rebufferRatio / incident.before.rebufferRatio).toBeGreaterThan(3);
      expect(incident.during.plays).toBeGreaterThan(0);
      expect(incident.scopePlays).toBeGreaterThan(incident.during.plays);
    },
    15_000
  );

  it(
    "reports the whole incident when zoomed into its first hours, and keeps a pinned filter in the scope",
    async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const to = currentHourSec();
      const incident = await detectIncident({
        range: { from: to - 110 * 3600, to: to - 90 * 3600 },
        dataEndSec: to,
        metric: "rebufferRatio",
        filters: { device: ["SmartTV"] },
      });
      expect(incident?.path).toEqual([{ dimension: "cdn", value: "Fastly" }]);
      expect(incident?.scope.map((s) => s.value)).toEqual(["SmartTV", "Fastly"]);
      expect(incident && (incident.window.to - incident.window.from) / 3600).toBe(10);
    },
    15_000
  );

  it(
    "finds nothing on a healthy slice of traffic",
    async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const to = currentHourSec();
      const incident = await detectIncident({
        range: { from: to - 7 * DAY, to },
        dataEndSec: to,
        metric: "rebufferRatio",
        filters: { cdn: ["Akamai"] },
      });
      expect(incident).toBeNull();
    },
    15_000
  );
});

describe("analysisRange", () => {
  it("extends short ranges back to a week so there is a baseline", () => {
    expect(analysisRange({ from: 10 * DAY, to: 11 * DAY }, 11 * DAY)).toEqual({ from: 4 * DAY, to: 11 * DAY });
    expect(analysisRange({ from: 0, to: 30 * DAY }, 30 * DAY)).toEqual({ from: 0, to: 30 * DAY });
  });

  it("looks up to a day past the range, but never past the end of the data", () => {
    expect(analysisRange({ from: 10 * DAY, to: 11 * DAY }, 20 * DAY)).toEqual({ from: 5 * DAY, to: 12 * DAY });
    expect(analysisRange({ from: 10 * DAY, to: 11 * DAY }, 11.5 * DAY)).toEqual({ from: 4.5 * DAY, to: 11.5 * DAY });
  });
});

describe("withRetry", () => {
  it("retries server errors and then succeeds", async () => {
    const call = vi.fn().mockRejectedValueOnce(new ApiError("boom", 500)).mockResolvedValueOnce("ok");
    await expect(withRetry(call)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt and rethrows", async () => {
    const call = vi.fn().mockRejectedValue(new ApiError("boom", 500));
    await expect(withRetry(call, undefined, 3)).rejects.toThrow("boom");
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("does not retry other errors", async () => {
    const call = vi.fn().mockRejectedValue(new TypeError("bug"));
    await expect(withRetry(call)).rejects.toThrow("bug");
    expect(call).toHaveBeenCalledTimes(1);
  });
});
