# Daily Diagnosis Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `DailyDiagnosisCard` into the newer SaaS root-cause diagnostic-card pattern.

**Architecture:** One visual-only edit in `components/dashboard-shell.tsx`. No behavior, state, API, diagnosis, badge, evidence, tone, print, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade DailyDiagnosisCard surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 3967-4023)

- [x] Replace the outer `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"` while preserving `data-print-flow`.
- [x] Preserve danger accent styling by keeping the conditional `border-l-4 border-l-destructive` class on the outer wrapper.
- [x] Replace `CardHeader` with a custom header using localized eyebrow, title, description, and badge.
- [x] Preserve the existing title, description, badge text, and badge variant exactly.
- [x] Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- [x] Wrap the diagnosis summary in `rounded-xl border bg-background/50 p-4`.
- [x] Preserve cause row ordering, evidence badges, action copy, and `DiagnosticNextStep` rendering exactly.
- [x] Upgrade cause rows to `rounded-xl border px-3 py-2.5` while preserving danger styling.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the ads route still renders.
- [x] Commit intentional files only.
