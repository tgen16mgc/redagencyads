# Dashboard Comparison Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's split KPI delta and compare-mode logic with one shared comparison engine so the top six metric cards and compare panel explain the same movement from the same source of truth.

**Architecture:** Add a focused `lib/metric-comparison.ts` module that owns comparison windows, metric direction, percentage deltas, and KPI-specific comparison rows. `DashboardShell` becomes a renderer: it asks the module for KPI deltas and panel rows, then formats them using the existing `KpiCard.format` metadata. Compare mode continues fetching a previous report; when no previous report exists, top KPI cards use a recomputed recent-vs-prior daily-window comparison from the current report.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Vitest, existing `DashboardReport`, `KpiCard`, `NormalizedRow`, and `sumRows` metric aggregation.

---

## Current Root Cause

The dashboard currently has two comparison systems:

1. Top KPI cards call local `kpiDelta(report, kpi)` in `components/dashboard-shell.tsx:2826`.
   - It compares the latest daily rows inside the current report against the immediately prior daily rows inside the same report.
   - It sums metrics only when `kpi.format === "number"`.
   - It averages currency, percent, and ratio metrics, which can disagree with account-level totals.

2. Compare mode fetches a separate previous report in `components/dashboard-shell.tsx:733` and compares full-report totals via `comparisonDeltas(current, previous)` in `lib/metrics.ts:496`.
   - It compares the current selected range against WoW/MoM/YoY shifted ranges from `lib/report-ranges.ts:8`.
   - It uses `DashboardReport.totals`, which are produced by `sumRows` in `lib/metrics.ts:104`.

The long-term fix is not to patch one display. The long-term fix is to make comparison a domain concept with one tested implementation.

## File Structure

- Create: `lib/metric-aggregation.ts`
  - Owns reusable row aggregation helpers that are not UI-specific.
  - Exports `sumRows` so both `lib/metrics.ts` and `lib/metric-comparison.ts` can share derived-metric aggregation without circular imports.

- Create: `lib/metric-comparison.ts`
  - Owns all reusable comparison logic.
  - Exports `MetricComparisonDelta`, `buildKpiComparisons`, `buildComparisonPanelDeltas`, `metricMovementIsBad`, `comparisonDescriptor`, and `compareTotals`.
  - Uses `sumRows` from `lib/metric-aggregation.ts` for daily-window totals so derived metrics are recomputed consistently instead of averaged.

- Create: `lib/__tests__/metric-comparison.test.ts`
  - Tests report-to-report comparison, recent-vs-prior fallback, derived metric aggregation, KPI filtering, and movement direction.

- Modify: `lib/metrics.ts:104-135`
  - Move the existing `sumRows` implementation into `lib/metric-aggregation.ts`.
  - Re-export `sumRows` from `lib/metrics.ts` to keep existing imports working.

- Modify: `lib/metrics.ts:496-523`
  - Keep the public `comparisonDeltas(current, previous)` export for AI prompt compatibility.
  - Delegate it to the shared module so AI, compare panel, and KPI cards use the same delta math.

- Modify: `components/dashboard-shell.tsx:82`
  - Import comparison helpers from `@/lib/metric-comparison`.
  - Keep `comparisonDeltas` imported from `@/lib/metrics` only if still needed directly by this file; otherwise remove it from this import.

- Modify: `components/dashboard-shell.tsx:1167-1181`
  - Replace per-card calls to local `kpiDelta(report, kpi)` with precomputed `kpiComparisons` from the shared module.
  - Change the label from generic `vs prior period` to a descriptor returned by the shared module.

- Modify: `components/dashboard-shell.tsx:1905-1941`
  - Make `ComparisonPanel` render `buildComparisonPanelDeltas(current, previous)` instead of a hardcoded comparison metric filter.
  - This makes panel rows match the selected KPI pack first, while still allowing diagnostic metrics if the helper explicitly includes them later.

- Modify: `components/dashboard-shell.tsx:2793-2842`
  - Replace `formatComparisonMetric` with `formatMetric(delta.current, delta.format, currency)`.
  - Replace `isBadKpiDelta` calls with `metricMovementIsBad(delta.key, delta.change)`.
  - Delete local `kpiDelta`.
  - Keep local `averageRows` and `sumRows` only for chart reference values at `components/dashboard-shell.tsx:2850-2851`.

---

### Task 1: Extract reusable metric aggregation

**Files:**
- Create: `lib/metric-aggregation.ts`
- Modify: `lib/metrics.ts:104-135`
- Test: `lib/__tests__/metrics.test.ts`

- [ ] **Step 1: Create `lib/metric-aggregation.ts`**

```ts
import type { NormalizedRow } from "@/lib/types";

const ZERO_ROW: Omit<NormalizedRow, "id" | "level" | "name"> = {
  spend: 0,
  impressions: 0,
  reach: 0,
  frequency: 0,
  clicks: 0,
  linkClicks: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  messages: 0,
  replies: 0,
  leads: 0,
  purchases: 0,
  addToCart: 0,
  initiateCheckout: 0,
  costPerMessage: 0,
  costPerReply: 0,
  cpl: 0,
  cpaPurchase: 0,
  roas: 0,
  replyRate: 0,
  leadRate: 0,
};

const safeDivide = (top: number, bottom: number) => (bottom ? top / bottom : 0);

export function sumRows(rows: NormalizedRow[], name: string): NormalizedRow {
  const total = rows.reduce<NormalizedRow>(
    (sum, row) => ({
      ...sum,
      spend: sum.spend + row.spend,
      impressions: sum.impressions + row.impressions,
      reach: sum.reach + row.reach,
      clicks: sum.clicks + row.clicks,
      linkClicks: sum.linkClicks + row.linkClicks,
      messages: sum.messages + row.messages,
      replies: sum.replies + row.replies,
      leads: sum.leads + row.leads,
      purchases: sum.purchases + row.purchases,
      addToCart: sum.addToCart + row.addToCart,
      initiateCheckout: sum.initiateCheckout + row.initiateCheckout,
    }),
    { ...ZERO_ROW, id: "total", level: "account", name },
  );
  total.ctr = safeDivide(total.clicks, total.impressions) * 100;
  total.cpc = safeDivide(total.spend, total.clicks);
  total.cpm = safeDivide(total.spend, total.impressions) * 1000;
  total.frequency = safeDivide(total.impressions, total.reach);
  total.costPerMessage = safeDivide(total.spend, total.messages);
  total.costPerReply = safeDivide(total.spend, total.replies);
  total.cpl = safeDivide(total.spend, total.leads);
  total.cpaPurchase = safeDivide(total.spend, total.purchases);
  total.replyRate = safeDivide(total.replies, total.messages) * 100;
  total.leadRate = safeDivide(total.leads, total.messages) * 100;
  const roasSpend = rows.reduce((sum, row) => sum + (row.roas > 0 ? row.spend : 0), 0);
  total.roas = safeDivide(rows.reduce((sum, row) => sum + row.roas * row.spend, 0), roasSpend);
  return total;
}
```

- [ ] **Step 2: Update `lib/metrics.ts` imports**

Add this import below the existing type import:

```ts
import { sumRows } from "@/lib/metric-aggregation";
```

- [ ] **Step 3: Delete the local `sumRows` function from `lib/metrics.ts`**

Delete the full existing function block at `lib/metrics.ts:104-135`:

```ts
export function sumRows(rows: NormalizedRow[], name: string): NormalizedRow {
  const total = rows.reduce<NormalizedRow>(
    (sum, row) => ({
      ...sum,
      spend: sum.spend + row.spend,
      impressions: sum.impressions + row.impressions,
      reach: sum.reach + row.reach,
      clicks: sum.clicks + row.clicks,
      linkClicks: sum.linkClicks + row.linkClicks,
      messages: sum.messages + row.messages,
      replies: sum.replies + row.replies,
      leads: sum.leads + row.leads,
      purchases: sum.purchases + row.purchases,
      addToCart: sum.addToCart + row.addToCart,
      initiateCheckout: sum.initiateCheckout + row.initiateCheckout,
    }),
    { ...ZERO_ROW, id: "total", level: "account", name },
  );
  total.ctr = safeDivide(total.clicks, total.impressions) * 100;
  total.cpc = safeDivide(total.spend, total.clicks);
  total.cpm = safeDivide(total.spend, total.impressions) * 1000;
  total.frequency = safeDivide(total.impressions, total.reach);
  total.costPerMessage = safeDivide(total.spend, total.messages);
  total.costPerReply = safeDivide(total.spend, total.replies);
  total.cpl = safeDivide(total.spend, total.leads);
  total.cpaPurchase = safeDivide(total.spend, total.purchases);
  total.replyRate = safeDivide(total.replies, total.messages) * 100;
  total.leadRate = safeDivide(total.leads, total.messages) * 100;
  const roasSpend = rows.reduce((sum, row) => sum + (row.roas > 0 ? row.spend : 0), 0);
  total.roas = safeDivide(rows.reduce((sum, row) => sum + row.roas * row.spend, 0), roasSpend);
  return total;
}
```

- [ ] **Step 4: Re-export `sumRows` from `lib/metrics.ts`**

Add this export after the imports in `lib/metrics.ts`:

```ts
export { sumRows } from "@/lib/metric-aggregation";
```

- [ ] **Step 5: Run the existing metrics tests**

```bash
npm test -- lib/__tests__/metrics.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the aggregation extraction**

```bash
git add lib/metric-aggregation.ts lib/metrics.ts
git commit -m "refactor: extract metric row aggregation"
```

---

### Task 2: Add the shared comparison engine tests

**Files:**
- Create: `lib/__tests__/metric-comparison.test.ts`
- Read for context: `lib/__tests__/metrics.test.ts`
- Read for context: `lib/__tests__/comparison-root-cause.test.ts`

- [ ] **Step 1: Create the failing test file**

Create `lib/__tests__/metric-comparison.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import {
  buildComparisonPanelDeltas,
  buildKpiComparisons,
  comparisonDescriptor,
  metricMovementIsBad,
} from "../metric-comparison";
import type { DashboardReport, KpiCard, NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "campaign",
    name: "Row",
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    linkClicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    messages: 0,
    replies: 0,
    leads: 0,
    purchases: 0,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: 0,
    costPerReply: 0,
    cpl: 0,
    cpaPurchase: 0,
    roas: 0,
    replyRate: 0,
    leadRate: 0,
    ...overrides,
  };
}

function report(overrides: Partial<DashboardReport>): DashboardReport {
  const kpis: KpiCard[] = [
    { key: "spend", label: "Spend", format: "currency" },
    { key: "impressions", label: "Impressions", format: "number" },
    { key: "reach", label: "Reach", format: "number" },
    { key: "leads", label: "Leads", format: "number", intent: "good" },
    { key: "cpl", label: "CPL", format: "currency" },
    { key: "leadRate", label: "Lead/message", format: "percent" },
  ];

  return {
    account: { id: "act", name: "Account", currency: "VND" },
    selectedCampaigns: [],
    dateRange: { since: "2026-06-01", until: "2026-06-07" },
    detectedPack: "lead_gen",
    selectedPack: "lead_gen",
    packReason: "test",
    kpis,
    totals: row({ id: "total", level: "account", name: "Total" }),
    campaignRows: [],
    adsetRows: [],
    adRows: [],
    dailyRows: [],
    platformRows: [],
    ageGenderRows: [],
    health: { score: 100, grade: "A", checks: [] },
    prompt: "",
    pulledAt: "2026-06-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildKpiComparisons", () => {
  it("uses previous report totals when compare mode has fetched a previous report", () => {
    const current = report({
      totals: row({ id: "total", level: "account", name: "Total", spend: 200, leads: 10, cpl: 20 }),
      dailyRows: [
        row({ id: "d1", level: "daily", date: "2026-06-01", spend: 10, leads: 1 }),
        row({ id: "d2", level: "daily", date: "2026-06-02", spend: 10, leads: 1 }),
        row({ id: "d3", level: "daily", date: "2026-06-03", spend: 10, leads: 1 }),
        row({ id: "d4", level: "daily", date: "2026-06-04", spend: 10, leads: 1 }),
        row({ id: "d5", level: "daily", date: "2026-06-05", spend: 10, leads: 1 }),
        row({ id: "d6", level: "daily", date: "2026-06-06", spend: 10, leads: 1 }),
      ],
    });
    const previous = report({
      totals: row({ id: "total", level: "account", name: "Total", spend: 100, leads: 5, cpl: 20 }),
      dateRange: { since: "2026-05-25", until: "2026-05-31" },
    });

    const deltas = buildKpiComparisons({ current, previous, compareMode: "wow" });

    expect(deltas.find((delta) => delta.key === "spend")).toMatchObject({
      current: 200,
      previous: 100,
      change: 100,
      changePct: 100,
      basis: "compare-range",
      descriptor: "vs WoW",
    });
    expect(deltas.find((delta) => delta.key === "leads")?.changePct).toBe(100);
  });

  it("falls back to recent daily-window comparison when compare mode is off", () => {
    const current = report({
      dailyRows: [
        row({ id: "d1", level: "daily", date: "2026-06-01", spend: 10, leads: 1 }),
        row({ id: "d2", level: "daily", date: "2026-06-02", spend: 10, leads: 1 }),
        row({ id: "d3", level: "daily", date: "2026-06-03", spend: 10, leads: 1 }),
        row({ id: "d4", level: "daily", date: "2026-06-04", spend: 20, leads: 2 }),
        row({ id: "d5", level: "daily", date: "2026-06-05", spend: 20, leads: 2 }),
        row({ id: "d6", level: "daily", date: "2026-06-06", spend: 20, leads: 2 }),
      ],
    });

    const deltas = buildKpiComparisons({ current, previous: null, compareMode: "off" });

    expect(deltas.find((delta) => delta.key === "spend")).toMatchObject({
      current: 60,
      previous: 30,
      change: 30,
      changePct: 100,
      basis: "recent-window",
      descriptor: "vs prior period",
    });
    expect(deltas.find((delta) => delta.key === "leads")?.changePct).toBe(100);
  });

  it("recomputes derived daily-window metrics from summed rows instead of averaging daily rates", () => {
    const current = report({
      dailyRows: [
        row({ id: "d1", level: "daily", date: "2026-06-01", spend: 100, leads: 10, cpl: 10 }),
        row({ id: "d2", level: "daily", date: "2026-06-02", spend: 100, leads: 10, cpl: 10 }),
        row({ id: "d3", level: "daily", date: "2026-06-03", spend: 1, leads: 1, cpl: 1 }),
        row({ id: "d4", level: "daily", date: "2026-06-04", spend: 200, leads: 10, cpl: 20 }),
        row({ id: "d5", level: "daily", date: "2026-06-05", spend: 200, leads: 10, cpl: 20 }),
        row({ id: "d6", level: "daily", date: "2026-06-06", spend: 2, leads: 1, cpl: 2 }),
      ],
    });

    const deltas = buildKpiComparisons({ current, previous: null, compareMode: "off" });
    const cpl = deltas.find((delta) => delta.key === "cpl");

    expect(cpl?.current).toBeCloseTo(402 / 21);
    expect(cpl?.previous).toBeCloseTo(201 / 21);
    expect(cpl?.changePct).toBeCloseTo(100);
  });

  it("returns no KPI deltas when the current report has too few dated daily rows and no previous report", () => {
    const current = report({
      dailyRows: [
        row({ id: "d1", level: "daily", date: "2026-06-01", spend: 10 }),
        row({ id: "d2", level: "daily", date: "2026-06-02", spend: 20 }),
      ],
    });

    expect(buildKpiComparisons({ current, previous: null, compareMode: "off" })).toEqual([]);
  });
});

describe("buildComparisonPanelDeltas", () => {
  it("renders the selected top-six KPI set instead of a separate hardcoded metric set", () => {
    const current = report({
      totals: row({ id: "total", level: "account", name: "Total", spend: 200, impressions: 2000, reach: 1000, leads: 20, cpl: 10, leadRate: 25 }),
    });
    const previous = report({
      totals: row({ id: "total", level: "account", name: "Total", spend: 100, impressions: 1000, reach: 500, leads: 10, cpl: 10, leadRate: 20 }),
    });

    expect(buildComparisonPanelDeltas(current, previous).map((delta) => delta.key)).toEqual([
      "spend",
      "impressions",
      "reach",
      "leads",
      "cpl",
      "leadRate",
    ]);
  });
});

describe("metricMovementIsBad", () => {
  it("treats higher cost metrics as bad and higher result metrics as good", () => {
    expect(metricMovementIsBad("cpl", 5)).toBe(true);
    expect(metricMovementIsBad("cpl", -5)).toBe(false);
    expect(metricMovementIsBad("leads", -5)).toBe(true);
    expect(metricMovementIsBad("leads", 5)).toBe(false);
  });
});

describe("comparisonDescriptor", () => {
  it("names compare-mode and fallback periods for UI labels", () => {
    expect(comparisonDescriptor("compare-range", "wow", "en")).toBe("vs WoW");
    expect(comparisonDescriptor("compare-range", "mom", "vi")).toBe("so với MoM");
    expect(comparisonDescriptor("recent-window", "off", "en")).toBe("vs prior period");
    expect(comparisonDescriptor("recent-window", "off", "vi")).toBe("so với kỳ trước");
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails because the module does not exist**

Run:

```bash
npm test -- lib/__tests__/metric-comparison.test.ts
```

Expected: FAIL with an import error similar to:

```text
Cannot find module '../metric-comparison'
```

- [ ] **Step 3: Commit the failing test**

```bash
git add lib/__tests__/metric-comparison.test.ts
git commit -m "test: define dashboard comparison behavior"
```

---

### Task 3: Implement the shared comparison engine

**Files:**
- Create: `lib/metric-comparison.ts`
- Test: `lib/__tests__/metric-comparison.test.ts`

- [ ] **Step 1: Create `lib/metric-comparison.ts` with the shared implementation**

```ts
import { sumRows } from "@/lib/metric-aggregation";
import type { CompareMode, DashboardReport, KpiCard, NormalizedRow, ReportLanguage } from "@/lib/types";

type ComparisonBasis = "compare-range" | "recent-window";

export type MetricComparisonDelta = {
  key: keyof NormalizedRow;
  label: string;
  format: KpiCard["format"];
  current: number;
  previous: number;
  change: number;
  changePct: number | null;
  basis: ComparisonBasis;
  descriptor: string;
};

const LOWER_IS_BETTER = new Set<keyof NormalizedRow>([
  "cpc",
  "cpm",
  "cpl",
  "costPerMessage",
  "costPerReply",
  "cpaPurchase",
  "frequency",
]);

const HIGHER_IS_BETTER = new Set<keyof NormalizedRow>([
  "messages",
  "replies",
  "leads",
  "purchases",
  "linkClicks",
  "clicks",
  "impressions",
  "reach",
  "ctr",
  "roas",
  "replyRate",
  "leadRate",
]);

export function buildKpiComparisons(args: {
  current: DashboardReport;
  previous?: DashboardReport | null;
  compareMode: CompareMode;
  language?: ReportLanguage;
}): MetricComparisonDelta[] {
  const basis = args.previous ? "compare-range" : "recent-window";
  const previousTotals = args.previous ? args.previous.totals : recentPriorTotals(args.current);
  const currentTotals = args.previous ? args.current.totals : recentCurrentTotals(args.current);

  if (!currentTotals || !previousTotals) return [];

  return args.current.kpis
    .filter((kpi): kpi is KpiCard & { key: keyof NormalizedRow } => kpi.key !== "healthScore")
    .map((kpi) => buildDelta({
      kpi,
      currentTotals,
      previousTotals,
      basis,
      compareMode: args.compareMode,
      language: args.language ?? "en",
    }));
}

export function buildComparisonPanelDeltas(current: DashboardReport, previous: DashboardReport, language: ReportLanguage = "en") {
  return buildKpiComparisons({ current, previous, compareMode: "wow", language }).map((delta) => ({
    ...delta,
    descriptor: comparisonDescriptor("compare-range", "wow", language),
  }));
}

export function compareTotals(current: NormalizedRow, previous: NormalizedRow) {
  const keys: Array<keyof NormalizedRow> = [
    "spend",
    "impressions",
    "reach",
    "messages",
    "leads",
    "purchases",
    "linkClicks",
    "ctr",
    "frequency",
    "costPerMessage",
    "cpl",
    "cpaPurchase",
    "roas",
  ];

  return keys.map((key) => {
    const currentValue = Number(current[key] || 0);
    const previousValue = Number(previous[key] || 0);
    return {
      key,
      current: currentValue,
      previous: previousValue,
      change: currentValue - previousValue,
      change_pct: previousValue ? ((currentValue - previousValue) / previousValue) * 100 : null,
    };
  });
}

export function metricMovementIsBad(key: keyof NormalizedRow | string, change: number) {
  if (change === 0) return false;
  const metricKey = key as keyof NormalizedRow;
  if (LOWER_IS_BETTER.has(metricKey)) return change > 0;
  if (HIGHER_IS_BETTER.has(metricKey)) return change < 0;
  return false;
}

export function comparisonDescriptor(basis: ComparisonBasis, compareMode: CompareMode, language: ReportLanguage = "en") {
  if (basis === "recent-window") return language === "vi" ? "so với kỳ trước" : "vs prior period";
  if (compareMode === "wow") return language === "vi" ? "so với WoW" : "vs WoW";
  if (compareMode === "mom") return language === "vi" ? "so với MoM" : "vs MoM";
  if (compareMode === "yoy") return language === "vi" ? "so với YoY" : "vs YoY";
  return language === "vi" ? "so với kỳ trước" : "vs prior period";
}

function buildDelta(args: {
  kpi: KpiCard & { key: keyof NormalizedRow };
  currentTotals: NormalizedRow;
  previousTotals: NormalizedRow;
  basis: ComparisonBasis;
  compareMode: CompareMode;
  language: ReportLanguage;
}): MetricComparisonDelta {
  const current = Number(args.currentTotals[args.kpi.key] || 0);
  const previous = Number(args.previousTotals[args.kpi.key] || 0);
  const change = current - previous;
  return {
    key: args.kpi.key,
    label: args.kpi.label,
    format: args.kpi.format,
    current,
    previous,
    change,
    changePct: previous ? (change / previous) * 100 : null,
    basis: args.basis,
    descriptor: comparisonDescriptor(args.basis, args.compareMode, args.language),
  };
}

function recentCurrentTotals(report: DashboardReport) {
  const windows = recentWindows(report);
  return windows ? sumRows(windows.recentRows, "Recent KPI window") : null;
}

function recentPriorTotals(report: DashboardReport) {
  const windows = recentWindows(report);
  return windows ? sumRows(windows.priorRows, "Prior KPI window") : null;
}

function recentWindows(report: DashboardReport) {
  const dated = report.dailyRows
    .filter((row) => Boolean(row.date))
    .slice()
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));

  if (dated.length < 6) return null;

  const windowSize = Math.min(7, Math.floor(dated.length / 2));
  const recentRows = dated.slice(dated.length - windowSize);
  const priorRows = dated.slice(dated.length - windowSize * 2, dated.length - windowSize);

  if (!recentRows.length || !priorRows.length) return null;
  return { recentRows, priorRows };
}
```

- [ ] **Step 2: Fix the `ReportLanguage` import if TypeScript fails**

`ReportLanguage` is currently a local alias in `components/dashboard-shell.tsx`, not exported from `lib/types.ts`. If the previous step fails on that import, replace the import line with:

```ts
import { sumRows } from "@/lib/metric-aggregation";
import type { CompareMode, DashboardReport, KpiCard, NormalizedRow } from "@/lib/types";

type ReportLanguage = "en" | "vi";
```

- [ ] **Step 3: Run the comparison tests**

```bash
npm test -- lib/__tests__/metric-comparison.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run the existing metrics tests to check for import cycles or regression**

```bash
npm test -- lib/__tests__/metrics.test.ts lib/__tests__/comparison-root-cause.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the comparison engine**

```bash
git add lib/metric-comparison.ts lib/__tests__/metric-comparison.test.ts
git commit -m "feat: add shared dashboard comparison engine"
```

---

### Task 4: Delegate existing metrics comparison to the shared engine

**Files:**
- Modify: `lib/metrics.ts:1`
- Modify: `lib/metrics.ts:496-523`
- Test: `lib/__tests__/metric-comparison.test.ts`
- Test: `lib/__tests__/insights.test.ts`

- [ ] **Step 1: Update imports in `lib/metrics.ts`**

Change the first import from:

```ts
import type { CompareMode, CompetitorPlatform, CompetitorSpyAd, DashboardReport, InsightAction, InsightRow, KpiCard, KpiPack, MetaAccount, MetaCampaign, NormalizedRow } from "@/lib/types";
```

to:

```ts
import type { CompareMode, CompetitorPlatform, CompetitorSpyAd, DashboardReport, InsightAction, InsightRow, KpiCard, KpiPack, MetaAccount, MetaCampaign, NormalizedRow } from "@/lib/types";
import { compareTotals } from "@/lib/metric-comparison";
```

- [ ] **Step 2: Replace `comparisonDeltas` implementation**

Replace `lib/metrics.ts:496-523` with:

```ts
export function comparisonDeltas(current: DashboardReport, previous: DashboardReport) {
  return compareTotals(current.totals, previous.totals);
}
```

- [ ] **Step 3: Run tests that exercise AI comparison payloads**

```bash
npm test -- lib/__tests__/metric-comparison.test.ts lib/__tests__/insights.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit the delegation**

```bash
git add lib/metrics.ts
git commit -m "refactor: share report comparison delta math"
```

---

### Task 5: Wire top KPI cards to the shared comparison engine

**Files:**
- Modify: `components/dashboard-shell.tsx:36`
- Modify: `components/dashboard-shell.tsx:82`
- Modify: `components/dashboard-shell.tsx:1167-1181`
- Modify: `components/dashboard-shell.tsx:2816-2842`

- [ ] **Step 1: Add the comparison helper import**

Add this import near the other `@/lib/*` imports:

```ts
import { buildKpiComparisons, metricMovementIsBad } from "@/lib/metric-comparison";
```

- [ ] **Step 2: Remove `comparisonDeltas` from the metrics import if no longer used in this file after Task 6**

For now, keep the current import unchanged if `ComparisonPanel` still uses `comparisonDeltas`:

```ts
import { buildCompetitorSpyPrompt, buildInsightPrompt, comparisonDeltas, formatCompactNumber, formatMetric, formatSharePct } from "@/lib/metrics";
```

After Task 6, change it to:

```ts
import { buildCompetitorSpyPrompt, buildInsightPrompt, formatCompactNumber, formatMetric, formatSharePct } from "@/lib/metrics";
```

- [ ] **Step 3: Precompute KPI comparisons before rendering cards**

Inside `DashboardShell`, before the `return (` line, add:

```ts
  const kpiComparisons = React.useMemo(() => {
    if (!report) return new Map<string, ReturnType<typeof buildKpiComparisons>[number]>();
    return new Map(
      buildKpiComparisons({ current: report, previous: previousReport, compareMode, language })
        .map((delta) => [String(delta.key), delta]),
    );
  }, [report, previousReport, compareMode, language]);
```

If there is already a cluster of `useMemo` calls near the render return, place it with them. Do not move unrelated state or handlers.

- [ ] **Step 4: Replace the top KPI card delta block**

Replace this block:

```tsx
                {report.kpis.map((kpi) => {
                  const delta = kpiDelta(report, kpi);
                  return (
                    <Card key={kpi.label} size="sm">
                      <CardHeader>
                        <CardDescription className="text-xs font-medium uppercase tracking-wide">{kpi.label}</CardDescription>
                        <CardTitle className="text-3xl font-semibold tabular-nums leading-none">
                          {formatMetric(Number(report.totals[kpi.key as keyof NormalizedRow] || 0), kpi.format, report.account.currency || "VND")}
                        </CardTitle>
                        {delta !== null ? (
                          <CardDescription className={`text-xs tabular-nums ${isBadKpiDelta(kpi, delta) ? "text-destructive" : "text-muted-foreground"}`}>
                            {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {formatSignedPct(delta, language)} {language === "vi" ? "so với kỳ trước" : "vs prior period"}
                          </CardDescription>
                        ) : null}
                      </CardHeader>
                    </Card>
                  );
                })}
```

with:

```tsx
                {report.kpis.map((kpi) => {
                  const delta = kpiComparisons.get(String(kpi.key));
                  return (
                    <Card key={kpi.label} size="sm">
                      <CardHeader>
                        <CardDescription className="text-xs font-medium uppercase tracking-wide">{kpi.label}</CardDescription>
                        <CardTitle className="text-3xl font-semibold tabular-nums leading-none">
                          {formatMetric(Number(report.totals[kpi.key as keyof NormalizedRow] || 0), kpi.format, report.account.currency || "VND")}
                        </CardTitle>
                        {delta ? (
                          <CardDescription className={`text-xs tabular-nums ${metricMovementIsBad(delta.key, delta.change) ? "text-destructive" : "text-muted-foreground"}`}>
                            {delta.change > 0 ? "↑" : delta.change < 0 ? "↓" : "→"} {formatSignedPct(delta.changePct, language)} {delta.descriptor}
                          </CardDescription>
                        ) : null}
                      </CardHeader>
                    </Card>
                  );
                })}
```

- [ ] **Step 5: Delete obsolete local KPI delta logic**

Delete this block from `components/dashboard-shell.tsx:2816-2842`:

```ts
const LOWER_IS_BETTER_KPIS = new Set<string>(["cpc", "cpm", "cpl", "costPerMessage", "costPerReply", "cpaPurchase", "frequency"]);
const HIGHER_IS_BETTER_KPIS = new Set<string>(["messages", "replies", "leads", "purchases", "linkClicks", "clicks", "impressions", "reach", "ctr", "roas"]);

function isBadKpiDelta(kpi: DashboardReport["kpis"][number], delta: number) {
  if (delta === 0) return false;
  if (LOWER_IS_BETTER_KPIS.has(String(kpi.key))) return delta > 0;
  if (HIGHER_IS_BETTER_KPIS.has(String(kpi.key))) return delta < 0;
  return false;
}

function kpiDelta(report: DashboardReport, kpi: DashboardReport["kpis"][number]) {
  if (kpi.key === "healthScore") return null;
  const dated = report.dailyRows
    .filter((row) => Boolean(row.date))
    .slice()
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));
  if (dated.length < 6) return null;
  const windowSize = Math.min(7, Math.floor(dated.length / 2));
  const recentRows = dated.slice(dated.length - windowSize);
  const priorRows = dated.slice(dated.length - windowSize * 2, dated.length - windowSize);
  if (!recentRows.length || !priorRows.length) return null;

  const recent = kpi.format === "number" ? sumRows(recentRows, kpi.key) : averageRows(recentRows, kpi.key);
  const prior = kpi.format === "number" ? sumRows(priorRows, kpi.key) : averageRows(priorRows, kpi.key);
  if (prior <= 0) return null;
  return ((recent - prior) / prior) * 100;
}
```

Keep these helpers because chart code still uses them:

```ts
function averageRows(rows: NormalizedRow[], key: keyof NormalizedRow): number {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length;
}

function sumRows(rows: NormalizedRow[], key: keyof NormalizedRow): number {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}
```

- [ ] **Step 6: Run TypeScript build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit top-card wiring**

```bash
git add components/dashboard-shell.tsx
git commit -m "refactor: render KPI deltas from comparison engine"
```

---

### Task 6: Wire compare panel to the same KPI comparison rows

**Files:**
- Modify: `components/dashboard-shell.tsx:82`
- Modify: `components/dashboard-shell.tsx:1905-1941`
- Modify: `components/dashboard-shell.tsx:2793-2798`

- [ ] **Step 1: Expand the comparison import**

Change:

```ts
import { buildKpiComparisons, metricMovementIsBad } from "@/lib/metric-comparison";
```

to:

```ts
import { buildComparisonPanelDeltas, buildKpiComparisons, metricMovementIsBad } from "@/lib/metric-comparison";
```

- [ ] **Step 2: Remove `comparisonDeltas` from the metrics import**

Change:

```ts
import { buildCompetitorSpyPrompt, buildInsightPrompt, comparisonDeltas, formatCompactNumber, formatMetric, formatSharePct } from "@/lib/metrics";
```

to:

```ts
import { buildCompetitorSpyPrompt, buildInsightPrompt, formatCompactNumber, formatMetric, formatSharePct } from "@/lib/metrics";
```

- [ ] **Step 3: Replace the compare panel delta source**

Inside `ComparisonPanel`, replace:

```ts
  const deltas = comparisonDeltas(current, previous).filter((item) =>
    ["spend", "messages", "leads", "purchases", "linkClicks", "ctr", "frequency", "costPerMessage", "cpl", "roas"].includes(item.key),
  );
```

with:

```ts
  const deltas = buildComparisonPanelDeltas(current, previous, language);
```

- [ ] **Step 4: Replace the panel card render block**

Replace:

```tsx
          {deltas.slice(0, 10).map((delta) => (
            <div key={delta.key} className="rounded-lg border p-3">
              <div className="text-xs font-medium text-muted-foreground">{metricLabel(delta.key, language)}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{formatComparisonMetric(delta.key, delta.current, currency)}</div>
              <Badge variant={delta.change === 0 ? "secondary" : isBadKpiDelta({ key: delta.key } as any, delta.change) ? "destructive" : "success"} className="mt-2 tabular-nums">
                {formatSignedPct(delta.change_pct, language)}
              </Badge>
            </div>
          ))}
```

with:

```tsx
          {deltas.map((delta) => (
            <div key={delta.key} className="rounded-lg border p-3">
              <div className="text-xs font-medium text-muted-foreground">{delta.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{formatMetric(delta.current, delta.format, currency)}</div>
              <Badge variant={delta.change === 0 ? "secondary" : metricMovementIsBad(delta.key, delta.change) ? "destructive" : "success"} className="mt-2 tabular-nums">
                {formatSignedPct(delta.changePct, language)}
              </Badge>
            </div>
          ))}
```

- [ ] **Step 5: Delete obsolete `formatComparisonMetric`**

Delete this function from `components/dashboard-shell.tsx:2793-2798`:

```ts
function formatComparisonMetric(key: string, value: number, currency: string) {
  if (["spend", "costPerMessage", "cpl"].includes(key)) return formatMetric(value, "currency", currency);
  if (["ctr"].includes(key)) return formatMetric(value, "percent", currency);
  if (["frequency", "roas"].includes(key)) return formatMetric(value, "ratio", currency);
  return formatMetric(value, "number", currency);
}
```

- [ ] **Step 6: Run tests and build**

```bash
npm test -- lib/__tests__/metric-comparison.test.ts lib/__tests__/insights.test.ts && npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit compare-panel wiring**

```bash
git add components/dashboard-shell.tsx
git commit -m "refactor: align compare panel with KPI comparisons"
```

---

### Task 7: Fix compare-mode descriptor accuracy in the panel helper

**Files:**
- Modify: `lib/metric-comparison.ts`
- Modify: `components/dashboard-shell.tsx:1905-1914`
- Modify: `components/dashboard-shell.tsx:1192`
- Test: `lib/__tests__/metric-comparison.test.ts`

This task removes a shortcut from Task 3 where `buildComparisonPanelDeltas` assumed WoW. The panel already receives `mode`, so pass it through.

- [ ] **Step 1: Update the test for mode-aware panel labels**

Add this test inside `describe("buildComparisonPanelDeltas", ...)` in `lib/__tests__/metric-comparison.test.ts`:

```ts
  it("uses the active compare mode in panel descriptors", () => {
    const current = report({ totals: row({ id: "total", level: "account", name: "Total", spend: 200 }) });
    const previous = report({ totals: row({ id: "total", level: "account", name: "Total", spend: 100 }) });

    expect(buildComparisonPanelDeltas(current, previous, "mom", "en")[0].descriptor).toBe("vs MoM");
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

```bash
npm test -- lib/__tests__/metric-comparison.test.ts
```

Expected: FAIL because `buildComparisonPanelDeltas` currently expects `(current, previous, language)`.

- [ ] **Step 3: Update `buildComparisonPanelDeltas` signature and implementation**

Replace this function in `lib/metric-comparison.ts`:

```ts
export function buildComparisonPanelDeltas(current: DashboardReport, previous: DashboardReport, language: ReportLanguage = "en") {
  return buildKpiComparisons({ current, previous, compareMode: "wow", language }).map((delta) => ({
    ...delta,
    descriptor: comparisonDescriptor("compare-range", "wow", language),
  }));
}
```

with:

```ts
export function buildComparisonPanelDeltas(
  current: DashboardReport,
  previous: DashboardReport,
  compareMode: CompareMode,
  language: ReportLanguage = "en",
) {
  return buildKpiComparisons({ current, previous, compareMode, language });
}
```

- [ ] **Step 4: Update `ComparisonPanel` call site**

Replace this line in `ComparisonPanel`:

```ts
  const deltas = buildComparisonPanelDeltas(current, previous, language);
```

with:

```ts
  const deltas = buildComparisonPanelDeltas(current, previous, mode, language);
```

- [ ] **Step 5: Run focused test**

```bash
npm test -- lib/__tests__/metric-comparison.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit descriptor cleanup**

```bash
git add lib/metric-comparison.ts lib/__tests__/metric-comparison.test.ts components/dashboard-shell.tsx
git commit -m "fix: label comparison rows with active mode"
```

---

### Task 8: Manual UI verification

**Files:**
- No source changes expected.
- Verify: `components/dashboard-shell.tsx`
- Verify: `lib/metric-comparison.ts`

- [ ] **Step 1: Start the app**

```bash
npm run dev
```

Expected terminal output includes a local Next.js URL, usually:

```text
Local: http://localhost:3000
```

- [ ] **Step 2: Open the dashboard in a browser**

Visit the local URL from the dev server.

- [ ] **Step 3: Verify default compare-off KPI cards**

Use an account/date range with at least 6 daily rows. Pull report data.

Expected:

```text
Top six KPI cards show a small delta label ending with "vs prior period" or "so với kỳ trước".
No Compare mode panel is shown while Compare is Off.
```

- [ ] **Step 4: Verify compare mode aligns top cards and panel**

Set Compare to WoW, pull report data again.

Expected:

```text
Top six KPI cards show delta labels ending with "vs WoW".
The Compare mode panel appears.
The panel shows the same six KPI labels as the top cards.
For each shared KPI, the percentage in the top card matches the percentage in the compare panel.
```

- [ ] **Step 5: Verify MoM and YoY labels**

Set Compare to MoM and YoY, pulling report data after each change.

Expected:

```text
MoM top-card deltas say "vs MoM".
MoM panel title says "Compare mode: MoM".
YoY top-card deltas say "vs YoY".
YoY panel title says "Compare mode: YoY".
```

- [ ] **Step 6: Verify lower-is-better coloring**

Use a date range where CPL, CPC, cost/message, CPA, CPM, or frequency increased.

Expected:

```text
Increased cost/frequency metrics use destructive styling.
Increased result metrics such as leads, messages, purchases, link clicks, impressions, reach, CTR, ROAS, reply rate, and lead rate do not use destructive styling.
```

- [ ] **Step 7: Stop the dev server**

Press `Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 8: Commit verification-only adjustments if needed**

If manual verification revealed copy or wiring issues and they were fixed, commit them:

```bash
git add components/dashboard-shell.tsx lib/metric-comparison.ts lib/__tests__/metric-comparison.test.ts
git commit -m "fix: polish comparison UI behavior"
```

If no files changed, do not create an empty commit.

---

### Task 9: Final regression pass

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Check git diff for accidental scope creep**

```bash
git diff --stat
```

Expected changed files are limited to:

```text
components/dashboard-shell.tsx
lib/metric-comparison.ts
lib/metrics.ts
lib/__tests__/metric-comparison.test.ts
```

- [ ] **Step 4: Commit final fixes if needed**

If Step 1 or Step 2 required fixes, commit only the files changed for those fixes:

```bash
git add components/dashboard-shell.tsx lib/metric-comparison.ts lib/metrics.ts lib/__tests__/metric-comparison.test.ts
git commit -m "fix: stabilize dashboard comparison architecture"
```

If no files changed, do not create an empty commit.

---

## Self-Review

**Spec coverage:**
- Explains why current default top-card comparison and compare-mode numbers differ.
- Replaces split logic with one comparison engine.
- Keeps compare-mode range fetching unchanged.
- Recomputes fallback daily-window derived metrics from summed rows instead of averaging daily rates.
- Aligns the compare panel with the selected top-six KPI set.
- Preserves AI prompt compatibility through `comparisonDeltas` delegation.

**Placeholder scan:**
- No `TBD`, `TODO`, `implement later`, or unspecified test instructions remain.
- Every code-changing step includes exact code or exact replacement snippets.
- Every test step includes exact command and expected result.

**Type consistency:**
- Shared delta type uses `changePct` for UI rows.
- Legacy `comparisonDeltas` keeps `change_pct` for existing AI prompt compatibility.
- UI formatting uses `KpiCard.format` from `MetricComparisonDelta.format`.
- `buildComparisonPanelDeltas` becomes mode-aware in Task 7 before final verification.
