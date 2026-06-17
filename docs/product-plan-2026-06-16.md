# Product Plan — Diagnosis-First Dashboard

Date: 2026-06-16
Author: research + codebase audit
Scope: 3 features, 10 fixes/improvements, 5 UI/UX improvements

---

## How this plan was built

1. Listened to real marketers across r/PPC, r/FacebookAds, r/DigitalMarketing (threads ~3 months old).
2. Cross-checked against dashboard-vendor research (Coupler, Porter, AgencyAnalytics, Supermetrics, Windsor, BeastMetrics).
3. Audited the actual codebase to ground every item in real files, not generic advice.

### Voice of the user (what they actually said)

- **"Tell me WHY, not just what."** Top-upvoted artifact in the research was a marketer who dumped Triple Whale for a sheet that diagnoses causation: *"CTR down + Frequency up = creative fatigue. CVR down but CTR fine = funnel/landing-page problem. CPM up but CTR stable = auction got expensive, not your fault."* ([r/FacebookAds](https://www.reddit.com/r/FacebookAds/comments/1rvduzo/i_replaced_triple_whale_with_a_google_sheet_that/))
- **"ROAS down 19%, spent an hour figuring out why."** That hour is the unit of pain.
- **"Alerts are only good if they're quiet."** Fixed-threshold pings (5% CPA swing) get the app deleted. They want **learned, per-account** thresholds.
- **"Anyone can show a data table or a graph."** Pure viz with no "so what / next step" is considered worthless by senior operators.
- **Weekly cadence trains everyone to obsess over noise** and miss the quarter-long trend (CAC creeping up). Rolling baselines beat week-over-week.
- **Color-coded triage + one composite health score** was the *only* visualization pattern people praised. Nobody asked for funnels, scatter, cohort, or heatmaps.

### What the codebase already has (audit findings)

- **4 chart types already exist**, not 2: line, bar, area, composed (`lib/custom-chart.ts:5`). Fixed dashboard uses composed + line + horizontal bar.
- **18 diagnostic engines, wired as 34 cards** in `components/dashboard-shell.tsx` (creative-fatigue, comparison-root-cause, spend-pacing, consolidation-pressure, funnel-leakage, audience-overlap, budget-move-engine, etc.). The diagnosis *logic* is already rich.
- `dailyRows` carries up to 31 days of dated rows (`lib/meta.ts:242`, sliced `-31` in `lib/metrics.ts:298`) — single-report time-series diagnosis is feasible with **no new Meta API work**.

### The core insight

The product is **logic-rich but synthesis-poor**. Three structural gaps line up exactly with the user pain:

1. **Root-cause "WHY" only runs in comparison mode.** `analyzeComparisonRootCauses(current, previous)` (`dashboard-shell.tsx:1928`) needs two loaded reports. The #1 pain — "why did ROAS drop" on a *single* report — has no answer.
2. **34 equal-weight cards = the "anyone can show a graph" problem.** No triage hierarchy, no composite score at the top saying where to look first.
3. **No always-on baseline/anomaly detection** for the "slow bleed" (CPM +3%/week) that WoW misses.

So: **double down on diagnosis, don't chase chart-type parity.** Add exactly one chart type (funnel — it maps to existing `funnel-leakage` logic).

---

## 3 Features (net-new)

### F1 — Single-Report Root-Cause Diagnosis ("Why did this change?")
**The headline feature.** Bring the diagnostic logic that today only runs in comparison mode into a single report, applied to the daily trend.

- New module `lib/daily-diagnosis.ts`: split `report.dailyRows` into recent vs prior window (e.g. last 7d vs prior 7d, with a 3/3 fallback for short ranges), compute metric deltas, and classify with the marketer-validated rules:
  - CTR ↓ + Frequency ↑ → creative fatigue (reuse thresholds from `creative-fatigue.ts`)
  - Reach ↓ + CPM ↑ → audience saturation
  - CPM ↑ + CTR/CVR stable → auction pressure (not your fault)
  - CVR ↓ + CTR fine → funnel / landing-page problem (link to `funnel-leakage.ts`)
  - Result ↓ + Spend flat → efficiency decay
- Output a ranked list of plain-language causes, each with evidence (`"CTR down 18%, frequency up 22%"`) and a next step. Bilingual EN/VI.
- New `DailyDiagnosisCard` rendered near the top of the report (pinned in triage order — see F2).
- Pure function, fully unit-tested (`lib/__tests__/daily-diagnosis.test.ts`). No AI dependency; AI is optional wording polish only, consistent with the Verdict model.

**Why first:** directly kills "spent an hour figuring out what happened," reuses existing thresholds, needs no new API.

### F2 — Account Health Score + Triage Board
A single composite 0–100 score at the very top, with the 34 cards reorganized beneath it by severity (fail → warning → pass).

- New `lib/health-score.ts`: aggregate the existing engine outputs (each already returns a status/severity) into one weighted score. Reuse `report.health` (already has score/grade/checks at `types.ts:165`) as the base and fold in the diagnostic engines.
- New `TriageBoard` that groups existing diagnostic cards into three severity lanes; render fails first. Collapse "pass" cards behind a "X healthy checks" disclosure to cut visual noise.
- Color-coded, keyboard-navigable, WCAG AA.

**Why:** answers "where do I look first," the praised triage pattern, and tames the 34-card wall.

### F3 — Funnel Chart (the one new chart type worth adding)
A proper funnel visual for the e-commerce path, backed by data already computed in `funnel-leakage.ts` (`clickToCart`, `cartToCheckout`, `checkoutToPurchase`).

- Extend `CustomChartType` with `"funnel"` in `lib/custom-chart.ts`, OR ship a dedicated `FunnelChartCard` fed by `assessFunnelLeakage(report.totals).rates` (recommended: dedicated card, since the funnel uses stage data, not the daily series, so it does not fit the existing series model cleanly).
- Render stage bars (Link clicks → Add to cart → Checkout → Purchase) with drop-off % between stages and the existing leakage blockers shown inline.
- Respect the insufficient-data / non-ecommerce states `funnel-leakage.ts` already returns.
- Skip pie/donut entirely — universally panned in research as a headline viz.

**Why:** the #1 vendor-recommended chart; maps to logic we already have; visually answers "where are people dropping off."

---

## 10 Fixes & Improvements

> Numbered F-fix to distinguish from features.

1. **Rolling 4-week baseline anomaly detection.** New `lib/baseline-anomaly.ts` over `dailyRows`: flag metrics drifting from their 4-week rolling mean (catches the "slow bleed" WoW misses). Surface as inline badges on the trend chart and feed F1.
2. **Quiet-by-default alert thresholds.** Replace fixed cutoffs with per-account learned thresholds (e.g. frequency→ROAS tipping point) where engines currently hardcode constants (`creative-fatigue.ts` uses fixed `frequency >= 5`, `ctr < 0.8`). Compute account baseline, only flag meaningful deviations.
3. **Daily-level creative fatigue.** Today `classifyCreativeFatigue` is skipped for daily rows (`dashboard-shell.tsx:3045` `daily ? null`). Apply a daily-trend variant so fatigue shows in the time series, not just per ad set.
4. **Threshold reference lines on all diagnostic charts.** The diagnostic chart adds a CTR=1 reference line (`dashboard-shell.tsx:2939`) but trend/efficiency charts have none. Add benchmark/baseline reference lines so a marketer sees "good vs bad" without reading axis numbers.
5. **"So what / next step" line on every diagnostic card.** Several cards state status without an action. Audit all 34; ensure each renders a concrete next step (the engines mostly return `action`/`blockers` already — surface them consistently).
6. **Period-over-period delta on KPI cards.** Research calls absolute numbers less useful than deltas. KPI cards (`KpiCard` at `types.ts:143`) show value only; add the prior-period delta + direction when compare data is loaded.
7. **Funnel-leakage benchmark transparency.** `funnel-leakage.ts` hardcodes benchmarks (5% click-to-cart, 15% cart-to-checkout, 20% checkout-to-purchase) but the summary cites different numbers ("30%", "40%" in comments). Reconcile comment/threshold drift and show the benchmark next to the actual rate.
8. **Confidence/insufficient-data consistency.** Engines use varying floors (funnel needs 100 clicks, fatigue needs 1000 impressions / $10 spend). Centralize "insufficient data" gating so the UI never shows a confident verdict on thin data.
9. **Custom-chart "mixed formats" guidance.** Validation blocks 3+ formats (`custom-chart.ts:190`) with a terse message. Improve the error to name *which* metrics conflict and suggest the split, reducing dead-end states.
10. **Compact axis tick correctness for VND.** `formatAxisTick` uses compact currency notation (`custom-chart.ts:376`); verify VND large-number formatting (millions/billions) reads correctly and doesn't collide with the dual-axis width (`width={48}`).

---

## 5 UI/UX Improvements

1. **Triage hierarchy / visual weight.** (Supports F2.) Make fail-state cards visually dominant; demote healthy cards. Today all 34 cards carry equal weight — the literal "anyone can show a graph" complaint.
2. **Collapse healthy checks behind a disclosure.** "12 checks passed" expander instead of 12 green cards, cutting scroll fatigue and focusing attention on problems.
3. **Print/PDF flow polish.** Cards use `data-print-flow`; ensure the new triage order + health score export cleanly to the PDF report (the "Friday email" artifact users actually want).
4. **Tooltip + value formatting consistency.** Standardize `tabular-nums`, currency, and percent/ratio rendering across all charts (custom + fixed) so numbers line up and compare at a glance.
5. **Empty/loading state quality.** Diagnostic cards return `null` when data is thin (e.g. `funnel-leakage` non-ecommerce). Replace silent `null` with a short "not applicable / need more data" `Empty` state so the layout doesn't shift and users understand why a card is absent.

---

## Sequencing

1. **F1 (single-report diagnosis)** — highest pain relief, reuses thresholds, no API work.
2. **Fix #1, #2, #3** (baseline anomaly, quiet thresholds, daily fatigue) — feed F1 and stand alone.
3. **F2 (health score + triage)** — reorganizes existing cards; depends on engines being consistent (fixes #5, #8).
4. **F3 (funnel chart)** — self-contained, maps to existing logic.
5. Remaining fixes + all 5 UI/UX passes — polish layer.

Each `lib/*` module ships with vitest coverage matching the existing pattern in `lib/__tests__/`. UI built on shadcn/base-nova primitives per project convention, WCAG AA.

---

## Key research sources

- https://www.reddit.com/r/FacebookAds/comments/1rvduzo/i_replaced_triple_whale_with_a_google_sheet_that/
- https://www.reddit.com/r/PPC/comments/1s1ppxb/client_reporting_is_the_only_part_of_my_agency/
- https://www.reddit.com/r/FacebookAds/comments/1rbof8b/agencies_running_meta_ads_reporting_alerts/
- https://www.reddit.com/r/PPC/comments/1szu907/whats_your_fav_data_viz_tool_for_ppc/
- https://blog.coupler.io/facebook-ads-funnel/
- https://agencyanalytics.com/templates/dashboards/meta-ads-dashboard
- https://benly.ai/learn/meta-ads/reporting-analytics-guide
- https://www.ataccama.com/blog/why-pie-charts-are-evil (why to skip pie/donut)
