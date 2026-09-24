# StreamPulse — QoE Analytics Dashboard

A dashboard for a video streaming service that helps an engineer see **what went wrong and who was affected**.
Built with React 18, TypeScript (strict) and Vite, on top of the provided mock API (unmodified, failure rate intact).

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | |
| --- | --- |
| `npm run build` | Type-check (`tsc -b`) and production build |
| `npm test` | Unit and component tests (Vitest + Testing Library, 56 tests) |
| `npm run lint` | ESLint, with `no-explicit-any` as an error |

Requires Node 20+.

## Incident investigation

> Open **[`/?device=SmartTV&groupBy=cdn&breakdown=cdn`](http://localhost:5173/?device=SmartTV&groupBy=cdn&breakdown=cdn)** to go straight to the evidence.

| | Finding |
| --- | --- |
| **Affected CDN** | **Fastly** |
| **Affected device** | **SmartTV** (only the Fastly + SmartTV combination) |
| **When** | A **10-hour** window starting **4 days (96 h) before the latest data**. The dataset is generated relative to page load, so the date moves. In my run it was **Sep 20, 10:00–20:00 UTC**. |
| **Impact on that path** | Rebuffering **0.97% → 5.24% (×5.4)** · Startup time **2.77 s → 6.46 s (×2.3)** · Error rate **0.71% → 2.23% (×3.2)** · Bitrate **4.6 → 2.6 Mbps (−44%)** |
| **Blast radius** | About **15.4K plays** hit, which is **7.9% of all plays** in the window and **20.8% of SmartTV plays**. About 235 extra playback failures. Platform-wide rebuffering rose from 1.16% to 1.50% compared with the same hours the day before. |

**How I found it (in the dashboard):**
1. On the default **Last 7 days** view, the Rebuffering chart has one sharp spike, and Startup Time and Error Rate spike in the same window. (On 30 days the daily buckets dilute it, and 24 hours doesn't reach back far enough.)
2. **Group by → Device:** only the SmartTV line spikes. Every other device stays flat.
3. **Click SmartTV** in the breakdown table to filter to it, then **Group by → CDN**. Fastly jumps to about 5% while Akamai and CloudFront stay under 1%. Setting the breakdown to CDN shows Fastly with the highest rebuffering on SmartTV.
4. **Confirmed it's the combination, not the CDN alone:** filtering to Fastly and grouping by device shows no spike on Mobile, Desktop, Tablet or GameConsole.
5. The hover tooltip gives the exact buckets for the start and end of the incident. I checked the ratios against the hourly (24 h) aggregates through the same API.

## Architecture

```
src/
  api/                     provided mock API — untouched, excluded from lint
  app/                     layout shell
  features/
    dashboard/state/       URL-backed state: parse/serialise, pure transitions, provider
    filters/               range + multi-select dimension filters, active-filter chips
    summary/               metric cards with period-over-period change
    timeseries/            chart, grouping, legend toggles, CSV export
    breakdown/             server-side search / sort / pagination table
    theme/                 light/dark theme
  shared/                  formatting, change maths, debounce, CSV, UI primitives
```

**Key decisions**

- **The URL is the state.** Every selection is kept in the query string, and components read it through `useSyncExternalStore`. There's no second copy to drift out of sync. Copying the URL restores the view, and Back/Forward work: discrete changes push a history entry, search keystrokes replace it. Bad or hand-edited params fall back to defaults and the URL is rewritten to its canonical form.
- **Pure, tested transitions.** Rules like "any change that alters the result set resets the table to page 1" or "switching the breakdown dimension clears the search" live in one place (`transitions.ts`) instead of being scattered across click handlers.
- **Server state via TanStack Query.** Query keys are built from the state. The `AbortSignal` goes to the mock API, so stale requests are cancelled and can't overwrite newer results. Previous data stays on screen, dimmed with an "Updating…" label, while a page or filter change loads. For a grouping or dimension change the old rows would be mislabelled, so those show a skeleton instead.
- **Per-panel loading, empty and error states** go through one `AsyncContent` component. A failure only affects its own panel, and Retry works. Automatic retries are off on purpose so the mock's 12% failure rate stays visible. In production I'd turn on one retry with backoff.
- **Time ranges are anchored** to the hour the page loaded, the same hour the mock dataset ends. That keeps query keys stable (no refetch loops from `Date.now()`).
- **Correctness details:** ratio metrics are already percentages (not fractions), and startup time and bitrate are shown in s and Mbps. The metric's polarity decides good vs bad. A zero previous period (the 30-day range) shows "No data for previous period" instead of `Infinity%`. **Partial first and last buckets are shaded**, so a half-day of plays doesn't look like a traffic drop.
- **Accessibility:** good/bad changes are shown with an arrow, the word "better"/"worse" and colour, never colour alone. Everything works by keyboard (row buttons, `aria-sort`, `aria-pressed` cards, Escape closes popovers), live regions announce loading, and reduced motion is respected.

**Extras:** dark/light theme (no flash on load), CSV export of the chart data, toggling series from the legend, series colours that stay the same per value, and unit/component tests.

**With more time:** a custom date range, an anomaly marker on the chart, list virtualisation if dimension cardinality grew, visual regression tests, and code-splitting the chart behind `React.lazy`.

## AI tools used

I used Claude Code (Anthropic) as a pair programmer for scaffolding, first drafts of components and tests, and reviewing edge cases. I directed the architecture and decisions above, and I've reviewed and can explain every line.
