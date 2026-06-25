# Performance Charts Design

## Goal

Make the `PerformanceCharts` suite feel like a premium SaaS analytics workspace instead of a grid of generic chart cards.

## Scope

Update only `PerformanceCharts` inside `components/dashboard-shell.tsx` (around lines 3555-3765). Do not change chart data calculations, chart specs, anomaly detection, annotations, tooltips, reference lines, chart dimensions, empty-state logic, or print behavior.

## Design

### Chart suite container

- Keep the existing responsive grid structure: `grid gap-4 xl:grid-cols-3`.
- Preserve all chart ordering and column spans.
- Replace each generic `Card` wrapper with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow` on the no-data state.

### Chart headers

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header/body pattern.
- Keep every existing visible chart title and description copy exactly.
- Add localized eyebrow labels to make the chart suite feel diagnostic:
  - No-data: `Analytics Workspace` / `Không gian phân tích`
  - Trend chart: `Trend Monitor` / `Theo dõi xu hướng`
  - Efficiency chart: `Efficiency Curve` / `Đường hiệu quả`
  - Diagnostic chart: `Diagnostic Signal` / `Tín hiệu chẩn đoán`
  - Drilldown chart: `Ad Set Drilldown` / `Phân rã nhóm quảng cáo`
- Preserve anomaly badges and trend annotation badges in the trend chart header.

### Chart bodies

- Replace each `CardContent` with a plain body container.
- Wrap each chart or empty chart surface in `mt-5 rounded-xl border bg-background/50 p-4`.
- Preserve every `ChartContainer` prop and every chart component prop exactly.
- Preserve `ChartEmpty` rendering and language prop exactly.

## Accessibility

- Preserve heading order with plain `h2` titles.
- Do not add or remove interactive controls.
- Preserve existing chart tooltip behavior and text content.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
