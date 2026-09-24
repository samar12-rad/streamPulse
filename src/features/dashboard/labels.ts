import { DIMENSIONS, type DatePreset, type DimensionKey, type Filters } from "../../api/types";
import { presetLabel } from "../../shared/lib/timeRange";

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  device: "Device",
  country: "Country",
  cdn: "CDN",
};

/** Plural noun for placeholders such as "Search devices…". */
export const DIMENSION_NOUN_PLURAL: Record<DimensionKey, string> = {
  device: "devices",
  country: "countries",
  cdn: "CDNs",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Human label for a dimension value — country codes become names ("JP" → "Japan"). */
export function formatDimensionValue(dimension: DimensionKey, value: string): string {
  if (dimension !== "country") return value;
  try {
    return regionNames.of(value) ?? value;
  } catch {
    return value;
  }
}

/** "Japan + GameConsole in the last 24 hours" — used to make empty states specific. */
export function describeSelection(filters: Filters, range: DatePreset): string {
  const parts = DIMENSIONS.flatMap((dimension) =>
    (filters[dimension] ?? []).length ? [(filters[dimension] ?? []).map((v) => formatDimensionValue(dimension, v)).join(" or ")] : []
  );
  const scope = parts.length ? parts.join(" + ") : "all traffic";
  return `${scope} in the ${presetLabel(range).toLowerCase()}`;
}
