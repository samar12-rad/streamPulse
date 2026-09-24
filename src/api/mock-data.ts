/**
 * Deterministic synthetic dataset for the QoE Analytics assignment.
 *
 * You should not need to read or modify this file — talk to it through
 * `mock-api.ts`. It is deterministic: the same hour + dimension combination
 * always produces the same numbers, so charts do not jitter between refetches.
 */

import {
  CDNS,
  COUNTRIES,
  DEVICES,
  type Cdn,
  type Country,
  type Device,
  type DimensionKey,
  type Filters,
  type MetricKey,
  type TimeRange,
} from "./types";

const HOUR = 3600;
const DAY = 24 * HOUR;
export const DATASET_DAYS = 30;

export interface RawRow {
  ts: number;
  device: Device;
  country: Country;
  cdn: Cdn;
  plays: number;
  viewers: number;
  playSec: number;
  rebufferSec: number;
  startupMsSum: number;
  startupCount: number;
  errors: number;
  bitrateKbpsSum: number;
}

/* ------------------------------------------------------------------ *
 * Seeded RNG so the dataset is stable across reloads within a session
 * ------------------------------------------------------------------ */

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Shape of the traffic
 * ------------------------------------------------------------------ */

const DEVICE_WEIGHT: Record<Device, number> = {
  SmartTV: 1,
  Mobile: 0.82,
  Desktop: 0.48,
  Tablet: 0.24,
  GameConsole: 0.11,
};

const COUNTRY_WEIGHT: Record<Country, number> = {
  US: 1,
  IN: 0.88,
  GB: 0.42,
  DE: 0.36,
  BR: 0.3,
  JP: 0.19,
};

const CDN_WEIGHT: Record<Cdn, number> = {
  Akamai: 1,
  CloudFront: 0.68,
  Fastly: 0.44,
};

/** Baseline rebuffering ratio (fraction of play time) per device. */
const DEVICE_REBUFFER: Record<Device, number> = {
  SmartTV: 0.008,
  Mobile: 0.019,
  Desktop: 0.006,
  Tablet: 0.013,
  GameConsole: 0.009,
};

/** Baseline startup time in ms per device. */
const DEVICE_STARTUP: Record<Device, number> = {
  SmartTV: 2100,
  Mobile: 1450,
  Desktop: 980,
  Tablet: 1320,
  GameConsole: 1750,
};

/** Baseline bitrate in kbps per device. */
const DEVICE_BITRATE: Record<Device, number> = {
  SmartTV: 5400,
  Mobile: 2100,
  Desktop: 4200,
  Tablet: 2800,
  GameConsole: 4900,
};

const CDN_QUALITY: Record<Cdn, number> = {
  Akamai: 0.92,
  CloudFront: 1,
  Fastly: 1.18,
};

const COUNTRY_QUALITY: Record<Country, number> = {
  US: 0.9,
  IN: 1.35,
  GB: 0.95,
  DE: 0.93,
  BR: 1.22,
  JP: 0.88,
};

/** Hour-aligned end of the dataset. */
export const datasetEnd: number = Math.floor(Date.now() / 1000 / HOUR) * HOUR;
export const datasetStart: number = datasetEnd - DATASET_DAYS * DAY;

/**
 * A short window in which one delivery path degrades sharply. Deliberately
 * left unlabelled — the dashboard is what is supposed to surface it.
 */
const degradedStart = datasetEnd - 4 * DAY;
const degradedEnd = degradedStart + 10 * HOUR;

function isDegraded(ts: number, device: Device, cdn: Cdn): boolean {
  return cdn === "Fastly" && device === "SmartTV" && ts >= degradedStart && ts < degradedEnd;
}

/**
 * Slow drift across the 30 day window, so that a range and the range before it
 * differ in a believable way: traffic grows, rebuffering improves, startup
 * time regresses. Each metric moves in its own direction on purpose.
 */
function trends(ts: number) {
  const dayIndex = (ts - datasetStart) / DAY;
  return {
    traffic: 1 + 0.011 * dayIndex,
    rebuffer: 1.28 - 0.013 * dayIndex,
    startup: 0.9 + 0.0062 * dayIndex,
    bitrate: 0.94 + 0.0042 * dayIndex,
    errors: 1.05 - 0.0018 * dayIndex,
  };
}

function buildRow(ts: number, device: Device, country: Country, cdn: Cdn): RawRow {
  const rand = mulberry32(hashString(`${ts}|${device}|${country}|${cdn}`));

  const date = new Date(ts * 1000);
  const hourOfDay = date.getUTCHours();
  const dayOfWeek = date.getUTCDay();

  const diurnal = 0.62 + 0.38 * Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI);
  const weekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1.18 : 1;
  const trend = trends(ts);

  const plays = Math.max(
    1,
    Math.round(
      820 *
        DEVICE_WEIGHT[device] *
        COUNTRY_WEIGHT[country] *
        CDN_WEIGHT[cdn] *
        diurnal *
        weekend *
        trend.traffic *
        (0.85 + 0.3 * rand())
    )
  );

  const viewers = Math.round(plays * (0.58 + 0.16 * rand()));
  const avgSessionSec = 620 + 900 * rand();
  const playSec = Math.round(plays * avgSessionSec);

  const degradation = isDegraded(ts, device, cdn) ? 5.5 : 1;

  const rebufferRatio =
    DEVICE_REBUFFER[device] *
    CDN_QUALITY[cdn] *
    COUNTRY_QUALITY[country] *
    trend.rebuffer *
    (0.8 + 0.4 * rand()) *
    degradation;

  const startupMs =
    DEVICE_STARTUP[device] *
    CDN_QUALITY[cdn] *
    COUNTRY_QUALITY[country] *
    trend.startup *
    (0.85 + 0.3 * rand()) *
    (degradation > 1 ? 2.3 : 1);

  const errorRate =
    0.006 * CDN_QUALITY[cdn] * trend.errors * (0.7 + 0.6 * rand()) * (degradation > 1 ? 3.1 : 1);

  const bitrate =
    DEVICE_BITRATE[device] *
    (2 - CDN_QUALITY[cdn]) *
    trend.bitrate *
    (0.9 + 0.2 * rand()) *
    (degradation > 1 ? 0.55 : 1);

  return {
    ts,
    device,
    country,
    cdn,
    plays,
    viewers,
    playSec,
    rebufferSec: Math.round(playSec * rebufferRatio),
    startupMsSum: Math.round(startupMs * plays),
    startupCount: plays,
    errors: Math.round(plays * errorRate),
    bitrateKbpsSum: Math.round(bitrate * plays),
  };
}

let cache: RawRow[] | null = null;

/** Builds (once) and returns the whole dataset, ascending by timestamp. */
export function getDataset(): RawRow[] {
  if (cache) return cache;
  const rows: RawRow[] = [];
  for (let ts = datasetStart; ts < datasetEnd; ts += HOUR) {
    for (const device of DEVICES) {
      for (const country of COUNTRIES) {
        for (const cdn of CDNS) {
          rows.push(buildRow(ts, device, country, cdn));
        }
      }
    }
  }
  cache = rows;
  return rows;
}

export function selectRows(range: TimeRange, filters: Filters): RawRow[] {
  const device = filters.device?.length ? new Set(filters.device) : null;
  const country = filters.country?.length ? new Set(filters.country) : null;
  const cdn = filters.cdn?.length ? new Set(filters.cdn) : null;

  return getDataset().filter((row) => {
    if (row.ts < range.from || row.ts >= range.to) return false;
    if (device && !device.has(row.device)) return false;
    if (country && !country.has(row.country)) return false;
    if (cdn && !cdn.has(row.cdn)) return false;
    return true;
  });
}

const EMPTY_METRICS: Record<MetricKey, number> = {
  plays: 0,
  uniqueViewers: 0,
  avgBitrateKbps: 0,
  rebufferRatio: 0,
  startupTimeMs: 0,
  errorRate: 0,
};

/** Aggregates raw rows into the derived metrics the UI displays. */
export function aggregate(rows: RawRow[]): Record<MetricKey, number> {
  if (!rows.length) return { ...EMPTY_METRICS };

  let plays = 0;
  let viewers = 0;
  let playSec = 0;
  let rebufferSec = 0;
  let startupMsSum = 0;
  let startupCount = 0;
  let errors = 0;
  let bitrateKbpsSum = 0;

  for (const row of rows) {
    plays += row.plays;
    viewers += row.viewers;
    playSec += row.playSec;
    rebufferSec += row.rebufferSec;
    startupMsSum += row.startupMsSum;
    startupCount += row.startupCount;
    errors += row.errors;
    bitrateKbpsSum += row.bitrateKbpsSum;
  }

  return {
    plays,
    uniqueViewers: viewers,
    avgBitrateKbps: plays ? bitrateKbpsSum / plays : 0,
    rebufferRatio: playSec ? (rebufferSec / playSec) * 100 : 0,
    startupTimeMs: startupCount ? startupMsSum / startupCount : 0,
    errorRate: plays ? (errors / plays) * 100 : 0,
  };
}

export function dimensionValue(row: RawRow, dimension: DimensionKey): string {
  return row[dimension];
}

/** Bucket width chosen from the span of the range. */
export function granularityFor(range: TimeRange): number {
  const span = range.to - range.from;
  if (span <= 26 * HOUR) return HOUR;
  if (span <= 8 * DAY) return 3 * HOUR;
  return DAY;
}
