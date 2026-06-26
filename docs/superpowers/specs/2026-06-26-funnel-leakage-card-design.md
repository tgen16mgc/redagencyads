# Funnel Leakage Card Design

## Goal

Make `FunnelLeakageCard` feel like a premium SaaS funnel-diagnostics card instead of a generic card.

## Scope

Update only `FunnelLeakageCard` inside `components/dashboard-shell.tsx` around lines 4208-4277. Do not change funnel leakage assessment logic, stage calculation, item selection, benchmark/drop formatting, badge logic, diagnostic tone, or print behavior.

## Design

### Container

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow`.
- Preserve diagnostic accent styling by keeping `diagnosticAccentClass(leakage.variant)` on the outer wrapper.

### Header

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header.
- Add a localized eyebrow: `Funnel Diagnostics` / `Chẩn đoán phễu`.
- Keep the existing visible title and description copy exactly.
- Preserve the clean-label vs score badge logic and variant exactly.

### Body

- Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- For sufficient data, wrap the funnel stage bars in `rounded-xl border bg-background/50 p-4` while preserving stage ordering, values, drop text, benchmark text, bar colors, and width calculation.
- For insufficient data, upgrade the summary surface from `rounded-lg border bg-muted/20 p-3` to `rounded-xl border bg-background/50 p-4` while preserving summary text exactly.
- Wrap the blocker/summary item list in `rounded-xl border bg-background/50 p-4`.
- Preserve item selection, ordering, and text exactly.
- Preserve `DiagnosticNextStep kind="funnelLeakage"` and tone logic exactly.

## Accessibility

- Preserve heading order with a plain `h2` title.
- Do not add or remove interactive controls.
- Preserve list semantics for blockers and summaries.
- Preserve visible stage labels, values, and badge semantics.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
