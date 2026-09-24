import { ApiError } from "../../api/types";

/** Human-readable explanation of a failed request, for error states. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return `The query service returned a ${error.status}.`;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong while loading this data.";
}
