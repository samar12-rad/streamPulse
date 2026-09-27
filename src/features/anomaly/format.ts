import { formatDimensionValue } from "../dashboard/labels";
import type { Incident } from "./investigate";

/** The affected slice: "SmartTV × Fastly", or "all traffic" for a platform-wide incident. */
export function pathLabel(incident: Incident): string {
  return incident.scope.length ? incident.scope.map((s) => formatDimensionValue(s.dimension, s.value)).join(" × ") : "all traffic";
}
