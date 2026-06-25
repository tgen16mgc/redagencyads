# Insight Panel Design

## Goal

Make the `InsightPanel` feel like a premium SaaS insight workspace instead of a generic card with flat mini-cards.

## Scope

Update only `InsightPanel` inside `components/dashboard-shell.tsx` (around lines 2394-2488). Do not change insight generation behavior, provider/progress handling, row slicing, empty-state logic, print attributes, or any data mapping.

## Design

### Container Level

- Replace the outer `Card` wrapper with a custom `div` using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow` on the outer wrapper.
- Remove `CardHeader`, `CardTitle`, `CardDescription`, and `CardContent` wrappers for consistency with the polished output panels.

### Header

- Add a localized eyebrow: `AI Analyst` / `Chuyên gia AI`.
- Keep the existing visible title copy exactly.
- Keep the existing localized description copy exactly.
- Keep the generate button in a right-side `data-print-hidden` control cluster, preserving disabled/loading behavior and icons.

### Body

- Keep `AiProgressStatus` rendering unchanged.
- Place generated insight metadata in a calmer `rounded-xl border bg-background/50 p-4` summary strip.
- Upgrade individual insight row cards from `rounded-lg border bg-background p-3` to `rounded-xl border bg-card/70 p-4 shadow-sm`.
- Keep `data-print-expand`, line clamps, priorities, evidence, actions, and row ordering unchanged.
- Upgrade the empty state surface from `Empty className="border"` to `rounded-xl border bg-background/50`.

## Accessibility

- Preserve the existing button, disabled state, loading spinner, and text content.
- Do not add or remove interactive controls.
- Preserve readable heading order using a plain `h2` title.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
