import { parseDashboardState, serializeDashboardState, type DashboardState } from "./dashboardState";
import type { Transition } from "./transitions";

/**
 * A tiny external store over `window.location.search`, consumed through
 * `useSyncExternalStore`. The URL *is* the state — there is no second copy in
 * React to drift out of sync, and back/forward navigation just works.
 */

const URL_CHANGE_EVENT = "streampulse:url-change";

export type HistoryMode = "push" | "replace";

export function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_CHANGE_EVENT, onChange);
  };
}

export function getSearchSnapshot(): string {
  return window.location.search;
}

function writeState(state: DashboardState, mode: HistoryMode): void {
  const query = serializeDashboardState(state);
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

/**
 * Applies a transition to the *current* URL state (not a render-time copy), so
 * rapid successive updates never overwrite each other with stale data.
 *
 * Discrete selections push a history entry so Back undoes them; high-frequency
 * updates such as search keystrokes should use `replace`.
 */
export function applyTransition(transition: Transition, mode: HistoryMode = "push"): void {
  const current = parseDashboardState(window.location.search);
  const next = transition(current);
  if (serializeDashboardState(next) === serializeDashboardState(current)) return;
  writeState(next, mode);
}

/** Rewrites a hand-edited or stale URL into its canonical form without adding a history entry. */
export function canonicalizeUrl(): void {
  const canonical = serializeDashboardState(parseDashboardState(window.location.search));
  const currentQuery = window.location.search.replace(/^\?/, "");
  if (canonical !== currentQuery) writeState(parseDashboardState(window.location.search), "replace");
}
