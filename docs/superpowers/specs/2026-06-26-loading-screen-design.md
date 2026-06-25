# Loading Screen Design

## Goal

Make the initial authenticated loading screen feel consistent with the premium SaaS entry experience.

## Scope

Update only `LoadingScreen` inside `components/dashboard-shell.tsx` (lines 1720-1735). Do not change loading logic, app state, routing, data fetching, or `ReportSkeleton`.

## Design

Replace the plain centered `Card` with a branded loading surface:
- Use the same soft radial background treatment as `TokenScreen`.
- Add the Red Agency logo and product name above the loading copy.
- Use a rounded elevated card: `rounded-[2rem] border-border/60 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur-xl`.
- Keep `copy.title` and `copy.description` exactly visible.
- Replace the single block skeleton with stacked skeleton rows that resemble dashboard cards loading.
- Add a small spinner + localized loading label near the skeleton area.

## Accessibility

- Keep the loading message readable.
- Add `role="status"` and `aria-live="polite"` to the loading card.
- Do not add interactive controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify route rendering still succeeds.
