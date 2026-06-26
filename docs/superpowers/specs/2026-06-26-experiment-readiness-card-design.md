# Experiment Readiness Card Design

## Goal

Make `ExperimentReadinessCard` feel like a premium SaaS experiment-gating card instead of a generic card.

## Scope

Update only `ExperimentReadinessCard` inside `components/dashboard-shell.tsx` around lines 4026-4050. Do not change readiness assessment logic, blocker selection, next-action fallback, badge variant/text, print behavior, or `DiagnosticNextStep` rendering.

## Design

### Container

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow`.
- Preserve diagnostic accent styling by keeping `diagnosticAccentClass(readiness.variant)` on the outer wrapper.

### Header

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header.
- Add a localized eyebrow: `Experiment Gate` / `Cổng thử nghiệm`.
- Keep the existing visible title and description copy exactly.
- Preserve the readiness label badge and variant exactly.

### Body

- Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- Wrap the blocker/next-action list in a calmer inner surface: `rounded-xl border bg-background/50 p-4`.
- Preserve item ordering, list text, and the fallback from blockers to next action.
- Render list items as compact rows using `rounded-xl border bg-card/70 px-3 py-2` for clearer scanability.
- Preserve `DiagnosticNextStep kind="experimentReadiness"` and `toneFromVariant(readiness.variant)` exactly.

## Accessibility

- Preserve heading order with a plain `h2` title.
- Do not add or remove interactive controls.
- Preserve list semantics for readiness blockers/actions.
- Preserve all existing badge semantics and visible copy.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
