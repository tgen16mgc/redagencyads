# Performance Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `PerformanceCharts` into the newer SaaS analytics-card pattern.

**Architecture:** One visual-only edit in `components/dashboard-shell.tsx`. No behavior, state, API, chart, anomaly, tooltip, reference-line, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade PerformanceCharts surfaces

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 3555-3765)

- [x] Replace the no-data `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"` while preserving `data-print-flow`.
- [x] Replace no-data `CardHeader` with a custom header using localized eyebrow, title, and description.
- [x] Preserve no-data title and description copy exactly.
- [x] Replace no-data `CardContent` with a plain body container wrapping `ChartEmpty` in `mt-5 rounded-xl border bg-background/50 p-4`.
- [x] Replace trend, efficiency, diagnostic, and drilldown `Card` wrappers with custom rounded SaaS surfaces while preserving `xl:col-span-2` where present.
- [x] Replace each chart `CardHeader` with a custom header using localized eyebrow, title, and description.
- [x] Preserve anomaly badges and trend annotation badge rendering exactly.
- [x] Replace each chart `CardContent` with a plain body container wrapping existing chart/empty rendering in `mt-5 rounded-xl border bg-background/50 p-4`.
- [x] Preserve every `ChartContainer`, chart component, tooltip, axis, bar, line, reference-line, data, and formatting prop exactly.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the ads route still renders.
- [x] Commit intentional files only.
