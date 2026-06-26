# Budget Move Engine Card Design

## Goal

Make `BudgetMoveEngineCard` feel like a premium SaaS budget-allocation recommendation card instead of a generic card.

## Scope

Update only `BudgetMoveEngineCard` inside `components/dashboard-shell.tsx` around lines 4149-4203. Do not change budget recommendation logic, hold reason logic, badge variants, summary copy, recommendation ordering, target/source reason rendering, diagnostic tone, or print behavior.

## Design

### Container

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow`.
- Preserve diagnostic accent styling by keeping `diagnosticAccentClass(engine.variant)` on the outer wrapper.

### Header

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header.
- Add a localized eyebrow: `Budget Engine` / `Động cơ ngân sách`.
- Keep the existing visible title and description copy exactly.
- Preserve the engine label badge and variant exactly.

### Body

- Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- Wrap the engine summary in `rounded-xl border bg-background/50 p-4`.
- Preserve summary copy exactly.
- Preserve recommendation ordering and all target/source reason rendering.
- Upgrade recommendation rows from `rounded-lg border p-3` to `rounded-xl border bg-background/50 px-3 py-2.5`.
- Preserve suggested move percent badges, max increase/reduction copy, and tabular number styling exactly.
- When no recommendations are available, wrap hold reasons in `rounded-xl border bg-background/50 p-4` while preserving list text and ordering.
- Preserve `DiagnosticNextStep kind="budgetMove"` and tone logic exactly.

## Accessibility

- Preserve heading order with a plain `h2` title.
- Do not add or remove interactive controls.
- Preserve list semantics for hold reasons and nested target/source reasons.
- Preserve readable row labels and badge semantics.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
