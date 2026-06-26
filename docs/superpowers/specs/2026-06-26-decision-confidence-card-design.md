# Decision Confidence Card Design

## Goal

Make `DecisionConfidenceCard` feel like a premium SaaS evidence-gating card instead of a generic card.

## Scope

Update only `DecisionConfidenceCard` inside `components/dashboard-shell.tsx` around lines 4058-4104. Do not change confidence assessment logic, row filtering, blocked/actionable counts, blocked row slicing, badge variants, summary copy, diagnostic tone, or print behavior.

## Design

### Container

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow`.
- Preserve diagnostic accent styling by keeping `diagnosticAccentClass(variant)` on the outer wrapper.

### Header

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header.
- Add a localized eyebrow: `Evidence Gate` / `Cổng bằng chứng`.
- Keep the existing visible title and description copy exactly.
- Preserve the actionable-count badge text and variant exactly.

### Body

- Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- Wrap the summary copy in `rounded-xl border bg-background/50 p-4`.
- Preserve the no-spend and blocked-count summary copy exactly.
- Preserve blocked row ordering and `topBlocked` slicing.
- Upgrade blocked rows from `rounded-lg border p-2` to `rounded-xl border bg-background/50 px-3 py-2.5`.
- Preserve row names, confidence badge variants/text, and first reason copy exactly.
- Preserve `DiagnosticNextStep kind="decisionConfidence"` and tone logic exactly.

## Accessibility

- Preserve heading order with a plain `h2` title.
- Do not add or remove interactive controls.
- Preserve readable row labels and badge semantics.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
