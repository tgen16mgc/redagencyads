# Competitor output sections design

## Goal

Make the competitor analysis output sections (profiles, themes, gaps, briefs, next actions) feel like structured SaaS insight cards instead of plain bordered blocks.

## Scope

Update only the result output sections inside `components/dashboard-shell.tsx` in the `CompetitorSpyPanel` result branch, lines 2814–2886.

Do not change analysis data, result parsing, provider selection, platform selection, ad fetching, routing, state, API calls, the analysis summary card, or the SpyAdsPanel.

## Design

Apply a consistent elevated card treatment to all four output sections:

### Competitor profiles (lines 2814–2824)
- Upgrade from `rounded-lg border bg-background p-3` to `rounded-2xl border bg-card/70 p-4 shadow-sm`.
- Add a localized section eyebrow label.
- Separate positioning and gap into distinct labeled lines.

### Themes + creative gaps (lines 2826–2857)
- Upgrade outer containers from `rounded-lg border bg-background p-3` to `rounded-2xl border bg-background p-4`.
- Upgrade inner theme cards from `rounded-md border p-3` to `rounded-xl border bg-card/70 p-3 shadow-sm`.
- Keep confidence badge, evidence, and opportunity text.

### Test briefs (lines 2859–2879)
- Upgrade outer container from `rounded-lg border bg-background p-3` to `rounded-2xl border bg-background p-4`.
- Upgrade inner brief cards from `rounded-md border p-3` to `rounded-xl border bg-card/70 p-3 shadow-sm`.
- Keep angle, hook, format badge, and why text.

### Next actions (lines 2881–2886)
- Upgrade outer container from `rounded-lg border bg-background p-3` to `rounded-2xl border bg-background p-4`.
- Keep CompactList behavior unchanged.

Preserve behavior exactly:
- All data rendering, `compactText` limits, `line-clamp` values, `data-print-expand` attributes, `CompactList` usage, and slice limits remain unchanged.
- `competitors.map`, `themeRows.map`, `briefs.map`, and `result.next_actions.slice(0, 4)` remain unchanged.

## Accessibility

- Do not change text content, reading order, or semantic structure.
- Keep contrast within existing token usage.
- Do not add or remove interactive controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify `/?view=competitor` still renders the competitor workspace.
