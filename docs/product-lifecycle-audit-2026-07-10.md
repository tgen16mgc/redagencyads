# Product lifecycle audit - 2026-07-10

## Scope

Tested the local product from first visit through authenticated Meta analysis, competitor research, TikTok intelligence, Page publishing validation, AI output, and PDF export.

## Current lifecycle status

| Area | Result | Current product state |
| --- | --- | --- |
| Meta token session | Pass | Token validation, encrypted session, account load, and campaign load work. |
| Meta report pull | Pass with no-data case | The tested account returned HTTP 200 but zero spend, impressions, and results for the default scope. The UI now stops before diagnostics. |
| Verdict, insights, PDF | Mechanically pass, now gated | The routes returned HTTP 200 and PDF downloaded on the zero-data report before the gate was added. They now require real report signal and still need a future live-data smoke. |
| Competitor automatic fetch | Fail | The public scraper mixed unrelated advertisers into the requested competitor and presented them as evidence. Automatic fetching is removed from the UI. |
| Competitor verified-note analysis | Pass | Manual competitor name plus verified ad-library notes produces a local analysis without calling the unsafe scraper. |
| TikTok profile and video pull | Pass | Apify returned normalized profile and video data. |
| TikTok Ad Library | Fail for product default | The actor rejects the default `VN` region. The Ad Library form is removed and replaced with a paused-state explanation. |
| Page publisher setup | Pass for safe checks | Page discovery, refresh, empty-content validation, and schedule-mode UI work. No live Page post was submitted during the audit. |
| Browser runtime | Pass after changes | No console errors or failed resources on the reduced public lifecycle. |
| Automated checks | Pass | `1084` tests pass and production build succeeds. Worktree test discovery is excluded. |

## Temporarily disabled or removed

- Automatic competitor ad fetching and its source, country, URL, limit, and fetch controls.
- Automatic pre-fetch before competitor analysis.
- TikTok Ad Library query controls and fetch button.
- Verdict, insights, custom analysis, and PDF export for all-zero Meta reports.
- Sidebar controls that looked clickable but were status-only elements.

## Redesign and repair plan

### P0 - Preserve truth and prevent unsafe output

1. Add a server capability contract for each workspace: configured, supported regions, permission state, last successful smoke test, and user-facing unavailable reason.
2. Define one report sufficiency gate shared by dashboard, Verdict, insights, and export routes so the server also rejects misleading all-zero analysis.
3. Require competitor evidence to pass advertiser-name relevance and source-provenance checks before it can enter analysis.
4. Add a confirmation step and explicit permission summary before a Page publish or schedule request leaves the app.

### P1 - Redesign the lifecycle around user jobs

1. Start with four explicit jobs: analyze my ads, analyze verified competitor evidence, inspect TikTok profiles, publish a Page post.
2. Ask for Meta authentication only inside jobs that require it.
3. Give every job the same state model: setup, validating, ready, running, evidence review, output, recoverable error.
4. Replace the global AI status card with provider status beside the actions that actually use it.

### P2 - Repair disabled data products

1. Competitor research: replace broad search-page scraping with page-ID or advertiser-bound retrieval, store per-ad provenance, reject mismatched advertisers, and show an evidence review step before analysis.
2. TikTok Ad Library: choose an actor that supports the target markets, expose only actor-supported countries, validate dates and query types locally, and smoke-test the final actor input schema.
3. Meta no-data recovery: explain whether the cause is date range, delivery, permissions, campaign status, or missing insights; suggest a wider range only when that is evidence-based.

### P3 - Make lifecycle regressions visible

1. Add browser tests for anonymous entry, authenticated report, zero-data report, verified-note competitor analysis, TikTok profile fetch, and Page publisher validation.
2. Add contract tests for third-party actor schemas and fixture tests for advertiser relevance.
3. Record route latency, provider fallback, empty-result reason, and source quality without logging tokens or ad-account secrets.
4. Run tests, build, and a browser smoke in CI from the active checkout only.

## Re-enable criteria

- Competitor fetch: at least 95% of returned ads match the requested advertiser in a labeled validation set, and every card has traceable source evidence.
- TikTok Ad Library: supported-country selection is generated from the actor contract and a `VN` request cannot be submitted unless supported.
- Meta analysis: no Verdict, insight, or export endpoint accepts a report that fails the shared sufficiency gate.
- Page publishing: permission preflight, confirmation, and a sandbox Page end-to-end test all pass.
