# Data source panel design

## Goal

Make the competitor fetched-ads panel feel like a trustworthy SaaS data-source surface instead of a small utility block.

## Scope

Update only `components/dashboard-shell.tsx` inside `SpyAdsPanel`.

Do not change fetch behavior, analysis behavior, warning content, ad ordering, ad limits, snapshot links, image loading, alt text meaning, print behavior, API calls, routing, or state.

## Design

Upgrade the panel into a compact evidence tray:
- Keep the current fetched ads count, fetched-at timestamp, warning alerts, ad cards, snapshot button, images, copy snippets, CTA, and start date.
- Place the status summary on a rounded card surface with a subtle background and ambient accent.
- Add a clear data-source badge so users understand the ads are public research inputs.
- Add a concise status line for empty and fetched states.
- In the fetched state, add small summary chips for reviewed creatives and latest sync.
- Give each ad preview card a more polished nested-card treatment while preserving the existing content and action.

Preserve behavior exactly:
- `window.open(ad.snapshotUrl, "_blank", "noopener,noreferrer")` remains unchanged.
- `ads.slice(0, 12)` remains unchanged.
- `warnings.slice(0, 3)` remains unchanged.
- `compactText` limits remain unchanged.
- Existing `data-print-expand` attributes remain on ad copy sections.

## Accessibility

- Preserve warning alert semantics.
- Preserve image `alt` text content.
- Preserve button type, size, variant, and click handler.
- Do not hide the fetched state or warning text.
- Keep text contrast within existing token usage.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify `/?view=competitor` renders:
  - `Competitor spy`
  - `Fetched ads` or `No ads fetched yet`
  - `Public data source`
  - existing setup and first-run content.
