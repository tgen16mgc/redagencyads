# Daily Diagnosis Card Design

## Goal

Make `DailyDiagnosisCard` feel like a premium SaaS root-cause diagnostic card instead of a generic card.

## Scope

Update only `DailyDiagnosisCard` inside `components/dashboard-shell.tsx` (around lines 3967-4023). Do not change diagnosis logic, cause selection, badge logic, evidence rendering, summary copy, next-step tone logic, or print behavior.

## Design

### Container

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow`.
- Preserve danger accent styling when any cause is dangerous by keeping the left destructive border condition.

### Header

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header.
- Add a localized eyebrow: `Root Cause` / `Nguyên nhân gốc`.
- Keep the existing title and description copy exactly.
- Preserve the existing badge text and variant logic exactly.

### Body

- Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- Place the diagnosis summary in a calmer inner surface: `rounded-xl border bg-background/50 p-4`.
- Preserve cause row ordering, evidence badges, action copy, and `DiagnosticNextStep` rendering.
- Upgrade cause rows from `rounded-lg border p-3` to `rounded-xl border px-3 py-2.5` while preserving danger styling.

## Accessibility

- Preserve heading order with a plain `h2` title.
- Do not add or remove interactive controls.
- Preserve all existing text content and badge semantics.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
