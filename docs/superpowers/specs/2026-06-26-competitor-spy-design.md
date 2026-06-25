# Competitor Spy Design

## Goal

Make the `CompetitorSpy` workspace feel like a premium SaaS competitive-intelligence panel instead of a generic card with a dense form/results grid.

## Scope

Update only the `CompetitorSpy` panel inside `components/dashboard-shell.tsx` (around lines 2607-2994). Do not change competitor inputs, fetch/analyze handlers, provider/source selects, copy-prompt behavior, ads rendering, result slicing, print attributes, or data mapping.

## Design

### Container level

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow` on the outer wrapper.
- Replace `CardHeader`, `CardTitle`, `CardDescription`, and `CardContent` with a custom header/body pattern.
- Keep the existing visible title and description copy exactly.
- Add a localized eyebrow: `Competitive Intelligence` / `Tình báo cạnh tranh`.
- Preserve the right-side generate and copy-prompt controls, including loading, disabled state, `aria-busy`, icons, handlers, and `data-print-hidden`.

### Body layout

- Keep the existing two-column responsive body layout: `grid gap-4 xl:grid-cols-[380px_1fr]`.
- Use a plain `div` body with `mt-5` spacing.
- Keep the input column hidden from print via `data-print-hidden`.
- Upgrade the input column surface to match the polished SaaS surface family while preserving all fields and controls.
- Upgrade advanced options from `rounded-lg border bg-background p-3` to `rounded-xl border bg-background/50 p-3`.

### Results and first-run surfaces

- Preserve `SpyAdsPanel`, result summary, competitor profiles, theme rows, creative gaps, briefs, next actions, and first-run content.
- Keep all result row ordering, slicing, copy, badges, and `data-print-expand` behavior unchanged.
- Upgrade major result/first-run panels from flat `bg-background` to calmer `bg-background/50` surfaces where they are already custom rounded sections.

## Accessibility

- Preserve all labels, descriptions, `aria-describedby`, `aria-labelledby`, and button semantics.
- Preserve heading order with a plain `h2` title in the main header.
- Do not add or remove interactive controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the competitor route still renders.
