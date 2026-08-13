# Dashboard Redesign Verification Handoff

## Mission

Complete integrated verification and the final re-audit of the Dashboard-only redesign on a machine that can build and render the full application. The implementation is intentionally not marked ready to ship until the real authenticated route, full typecheck, and production build pass.

- Branch: `work/dashboard-redesign-handoff`
- Base: `origin/main` at `5c4c0b6`
- Validation issue: https://github.com/tgen16mgc/redagencyads/issues/35
- Fix and ship re-audit issue: https://github.com/tgen16mgc/redagencyads/issues/36
- Suggested skills: `browser-testing-with-devtools`, `code-review-and-quality`, `web-design-guidelines`

## Repository Constraints

Read `AGENTS.md` before working. The important constraints for this continuation are:

- Keep changes limited to the Dashboard route/tab and directly required backward-compatible shared components.
- Preserve the application shell, unrelated pages, API contracts, business logic, data meaning, authentication, and existing design tokens.
- Do not add dependencies unless the existing stack cannot satisfy a verified requirement.
- Preserve unrelated working-tree files, especially `supabase/.temp/`, `tmp/authenticated-production-ui-audit.mjs`, and `tmp/export-sample-report.ts`.
- On the original 1 GB machine, run only one heavy process at a time and do not repeat the failed full-route compilation attempts.

## User And Primary Flow

The primary user is an agency performance operator deciding whether the current report evidence is trustworthy and what to investigate or act on next.

Primary flow:

`Dashboard -> identify the primary constraint -> confirm scope/readiness -> inspect objective-relevant KPIs -> drill into Creatives/Evidence -> act or export`

## Original Top 10 Findings

1. **P0 - Wrong primary result:** a Messages report showed lead count as `Results 72` instead of messages.
2. **P1 - Irrelevant metric:** a Messages report displayed `ROAS 0.0`.
3. **P1 - Hidden constraint:** the generic headline obscured the actual performance issue and next action.
4. **P1 - Unexplained readiness:** `3/4` did not identify the checks composing the score.
5. **P1 - Generic drilldowns:** every attention signal opened the same Performance overview.
6. **P1 - Mobile hierarchy failure:** scope cards pushed readiness and evidence below the fold.
7. **P2 - Ambiguous actions:** several differently labeled CTAs shared nearly identical destinations.
8. **P2 - Scope dominated decisions:** static account/date/campaign/rules context received excessive emphasis.
9. **P2 - Small touch targets:** several mobile controls measured below 44px.
10. **P2 - Illogical keyboard order:** fixed mobile navigation received focus before Dashboard content.

## Research Synthesis

Mobbin examples were used as pattern evidence, not a visual specification:

- Monarch: explicit task/readiness status with a concrete next action.
- Mixpanel: preserve analysis context while drilling into evidence.
- Lemon Squeezy: use one issue-specific action for each incomplete step.
- Supabase: state what is missing and provide one clear recovery action.
- Stripe and Wave: keep operational context compact and subordinate to the decision.

Do not copy their branding, card styling, navigation, or overall layouts.

## Implemented Changes

- `components/dashboard/workspace-overview.tsx`
  - Leads with the highest-priority diagnostic constraint.
  - Explains the readiness score composition.
  - Demotes scope context into a compact secondary row.
  - Shows metrics selected for the active KPI pack.
  - Gives each attention row a named evidence destination.
  - Raises Dashboard actions to at least 44px.
- `lib/dashboard-overview.ts`
  - Selects objective-aware overview metrics.
  - Maps creative issues to Creatives and other diagnostic issues to Evidence.
  - Generates repeatable targeted Performance navigation intents.
- `lib/__tests__/dashboard-overview.test.ts`
  - Covers objective-aware metrics, attention routing, repeated navigation, and generic reset behavior.
- `components/dashboard-shell.tsx`
  - Carries targeted Performance intent from the Dashboard.
  - Resets generic Performance navigation to Overview.
  - Places mobile navigation later in the DOM.
- `components/dashboard/ads-workspace.tsx`
  - Passes the requested Performance tab and intent key through to `PerformanceV2`.
- `components/dashboard/performance-v2.tsx`
  - Opens or reapplies `overview`, `creatives`, or `evidence` when a new intent arrives.
- `components/dashboard/app-sidebar.tsx`
  - Separates the fixed mobile navigation from the desktop sidebar so visual placement remains fixed but keyboard order follows page content.
- `app/landing/product-preview/product-preview.tsx`
  - Adds the required no-op callback for backward-compatible preview rendering.

No dependency, API contract, authentication behavior, data meaning, or new design system was introduced.

## Verification Completed

Passed on the constrained machine:

- Targeted Vitest with one worker: 3 files, 12 tests.
- TypeScript transpilation of all 8 changed TS/TSX files: no syntax diagnostics.
- `git diff --check`.
- Focused React/browser navigation harness:
  - Creative coverage opens `Creatives`.
  - CTR benchmark opens `Evidence`.
  - Repeated targeted clicks reapply the correct tab.
  - Generic Performance navigation opens `Overview`.
  - No component runtime console warnings or errors.
- Mobile focus-order harness: Dashboard actions precede assistant/mobile navigation.
- Sequential styled static inspection at approximately 1440px, 1024px, and 390px:
  - No horizontal overflow.
  - No visible label collisions.
  - No Dashboard targets below 44px.
  - Decision content remains first on mobile.

Baseline evidence remains local on the original machine:

- `/tmp/redagencyads-dashboard-baseline/desktop-1440.png`
- `/tmp/redagencyads-dashboard-baseline/compact-1024.png`
- `/tmp/redagencyads-dashboard-baseline/mobile-390.png`
- `/tmp/redagencyads-dashboard-baseline/audit.json`
- `/tmp/redagencyads-dashboard-baseline/interaction.json`

Styled after approximations remain local on the original machine:

- `/tmp/redagencyads-dashboard-static/desktop-1440.png`
- `/tmp/redagencyads-dashboard-static/compact-1024.png`
- `/tmp/redagencyads-dashboard-static/mobile-390.png`

Mobbin captures remain local on the original machine:

- `/tmp/mobbin-monarch.webp`
- `/tmp/mobbin-mixpanel.webp`
- `/tmp/mobbin-lemon.webp`
- `/tmp/mobbin-supabase.webp`

## Known Verification Blockers

The original machine has approximately 1 GB RAM. The following could not complete there and must be treated as open ship gates:

- Full `tsc --noEmit` exceeded a 384 MB Node heap.
- Next webpack and Turbopack compilation stalled or exhausted memory.
- Integrated post-change `DashboardShell` rendering timed out with rising swap and uninterruptible I/O.
- Full production build was not completed.

Do not infer integrated success from the static captures. They validate hierarchy and responsive geometry, not full application integration.

## Continuation Checklist

Work issue #35 first.

1. Check out `work/dashboard-redesign-handoff` and read `AGENTS.md` plus this handoff.
2. Review the full branch diff before changing code.
3. Run the full project typecheck and production build using conservative concurrency.
4. Render the real authenticated Dashboard with representative report fixtures.
5. Verify the primary flow and targeted navigation:
   - Creative coverage -> Creatives.
   - CTR/frequency -> Evidence.
   - Repeated targeted entries still open the requested tab.
   - Generic Performance navigation -> Overview.
6. Exercise applicable Dashboard filters, date range, tabs, search, tables/charts, export, loading, empty, and error states.
7. Inspect console and network output for runtime, hydration, request, and data-label failures.
8. Capture final integrated screenshots sequentially at approximately 1440px, 1024px, and 390px.
9. Check keyboard-only flow, focus visibility/order, labels, landmarks/headings, contrast, color-independent meaning, pointer targets, reflow, and chart/data interpretation.
10. Record exact commands, results, and evidence paths in this document or the issue.

If issue #35 finds a regression, work issue #36 next and fix only verified Dashboard problems. Re-run the relevant checks and mark every original finding as `Resolved`, `Improved but remaining`, `Not resolved`, or `Regressed`, with evidence.

## Current Re-audit Status

Focused verification currently supports:

1. Wrong Messages result - **Resolved**
2. Irrelevant ROAS - **Resolved**
3. Hidden primary constraint - **Resolved**
4. Unexplained readiness - **Resolved**
5. Generic attention routing - **Resolved**
6. Mobile hierarchy - **Resolved**
7. Ambiguous CTA language - **Resolved**
8. Scope dominating decisions - **Resolved**
9. Small mobile targets - **Improved but remaining**; Dashboard controls pass, but shared shell controls need integrated remeasurement.
10. Mobile keyboard order - **Resolved**

These statuses are provisional until the real integrated Dashboard passes issue #35.

## Ship Gate

Current status:

`NOT READY TO SHIP - blockers: integrated authenticated Dashboard rendering, full typecheck, production build, console/network QA, and final responsive/accessibility inspection.`

Only change this to `READY TO SHIP` after issues #35 and #36 are satisfied and no P0 or unjustified P1 issue remains.
