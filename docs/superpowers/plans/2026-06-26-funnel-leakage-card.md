# Funnel Leakage Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `FunnelLeakageCard` into the newer SaaS funnel-diagnostics card pattern.

**Architecture:** One visual-only edit in `components/dashboard-shell.tsx`. No behavior, state, API, funnel leakage assessment, stage calculation, badge, diagnostic tone, print, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade FunnelLeakageCard surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 4208-4277)

- [x] Replace the outer `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"` while preserving `data-print-flow`.
- [x] Preserve diagnostic accent styling by keeping `diagnosticAccentClass(leakage.variant)` on the outer wrapper.
- [x] Replace `CardHeader` with a custom header using localized eyebrow, title, description, and badge.
- [x] Preserve existing visible title and description copy exactly.
- [x] Preserve clean-label vs score badge rendering and variant exactly.
- [x] Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- [x] Wrap the funnel stage bars in `rounded-xl border bg-background/50 p-4` while preserving stage calculations, labels, values, drops, benchmarks, colors, and widths.
- [x] Upgrade the insufficient-data summary surface to `rounded-xl border bg-background/50 p-4` while preserving summary copy.
- [x] Wrap the blocker/summary item list in `rounded-xl border bg-background/50 p-4` while preserving list semantics, item selection, ordering, and text.
- [x] Preserve `DiagnosticNextStep` rendering and tone logic.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the ads route still renders.
- [ ] Commit intentional files only.
