# Health Triage Card Design

## Goal

Make `HealthTriageCard` feel like a premium SaaS diagnostic scorecard instead of a generic card.

## Scope

Update only `HealthTriageCard` inside `components/dashboard-shell.tsx` (around lines 3889-3962). Do not change health scoring, diagnosis creation, active item filtering, healthy item filtering, badges, print-only/print-hidden behavior, or next-step rendering.

## Design

### Container

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow`.
- Preserve the diagnostic accent styling when severity is danger by keeping the left destructive border condition.

### Header

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header.
- Add a localized eyebrow: `Health Triage` / `Phân loại sức khỏe`.
- Keep the existing visible title and description copy exactly.
- Preserve the summary label badge and its variant.

### Body

- Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- Upgrade the score summary row into a calmer inner surface: `rounded-xl border bg-background/50 p-4`.
- Preserve score, summary text, grade badge, separator, active priority items, healthy details, and `DiagnosticNextStep` rendering.
- Upgrade active priority rows from `rounded-lg border p-3` to `rounded-xl border px-3 py-2.5` while preserving danger styling.
- Upgrade healthy details and print-only healthy summary from `rounded-lg` to `rounded-xl` and `bg-background/50`.

## Accessibility

- Preserve heading order with a plain `h2` title.
- Preserve `details`/`summary` semantics and print attributes.
- Do not add or remove interactive controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
