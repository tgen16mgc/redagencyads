# Breakdown Analysis Section Design

## Goal

Make the breakdown analysis area feel like a premium SaaS diagnostic workspace instead of two generic cards.

## Scope

Update only `BreakdownAnalysisSection` and `BreakdownWasteCard` inside `components/dashboard-shell.tsx` (around lines 3201-3256 and 4365-4429). Do not change breakdown dimension selection, chart rendering, waste assessment, data mapping, diagnostics, or print behavior.

## Design

### Breakdown container

- Keep the existing two-column responsive section layout and `data-print-flow`.
- Replace the chart-side `Card` with a custom `div` using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Replace `CardHeader`, `CardTitle`, `CardDescription`, and `CardContent` with a custom header/body pattern.
- Add a localized eyebrow: `Segment Diagnostics` / `Chẩn đoán phân khúc`.
- Keep the existing title and description copy exactly.
- Wrap the chart body in `mt-5 rounded-xl border bg-background/50 p-4` so the controls, alert, and chart feel like one analysis surface.

### Waste side card

- Replace `BreakdownWasteCard`'s generic `Card` with a custom `div` using the same rounded SaaS surface.
- Preserve diagnostic accent styling from `diagnosticAccentClass`.
- Add a localized eyebrow: `Allocation Risk` / `Rủi ro phân bổ`.
- Keep existing title, description, badge, summary, waste rows, top segment rows, and next-step rendering.
- Upgrade internal list rows from `rounded-lg border p-2` to `rounded-xl border bg-background/50 px-3 py-2`.

## Accessibility

- Preserve the existing chart component, toggle groups, alert, and badge semantics.
- Preserve heading order with plain `h2` titles.
- Do not add or remove interactive controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
