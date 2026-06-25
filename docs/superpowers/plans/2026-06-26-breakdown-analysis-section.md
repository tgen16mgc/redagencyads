# Breakdown Analysis Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `BreakdownAnalysisSection` and `BreakdownWasteCard` into the newer SaaS diagnostic-card pattern.

**Architecture:** One visual-only edit in `components/dashboard-shell.tsx`. No behavior, state, API, chart, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade breakdown analysis surfaces

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 3201-3256 and 4365-4429)

- [x] Replace the chart-side `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"`.
- [x] Replace chart-side `CardHeader` with a custom header using eyebrow, title, and description.
- [x] Preserve the existing breakdown title and description copy exactly.
- [x] Replace chart-side `CardContent` with a plain body container wrapping `AdaptiveBreakdownChart` in `rounded-xl border bg-background/50 p-4`.
- [x] Preserve `AdaptiveBreakdownChart` props and behavior exactly.
- [x] Replace `BreakdownWasteCard`'s `Card` with a custom rounded SaaS surface while preserving `data-print-flow`, `self-start`, and diagnostic accent styling.
- [x] Replace `BreakdownWasteCard` header with eyebrow, title, description, and badge.
- [x] Preserve waste summary, waste rows, top segment rows, and `DiagnosticNextStep` rendering.
- [x] Upgrade internal side-card list rows to `rounded-xl border bg-background/50 px-3 py-2`.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the ads route still renders.
- [ ] Commit intentional files only.
