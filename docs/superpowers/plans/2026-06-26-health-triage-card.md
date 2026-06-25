# Health Triage Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `HealthTriageCard` into the newer SaaS diagnostic-scorecard pattern.

**Architecture:** One visual-only edit in `components/dashboard-shell.tsx`. No behavior, state, API, diagnostic, filtering, print, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade HealthTriageCard surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 3889-3962)

- [x] Replace the outer `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"` while preserving `data-print-flow`.
- [x] Preserve danger accent styling by keeping the conditional `border-l-4 border-l-destructive` class on the outer wrapper.
- [x] Replace `CardHeader` with a custom header using localized eyebrow, title, description, and badge.
- [x] Preserve existing visible title and description copy exactly.
- [x] Preserve summary label badge rendering and variant exactly.
- [x] Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- [x] Wrap the score, summary, and grade badge row in `rounded-xl border bg-background/50 p-4`.
- [x] Preserve score, summary text, grade badge, separator, active priority rows, healthy details, and `DiagnosticNextStep` rendering.
- [x] Upgrade active priority rows to `rounded-xl border px-3 py-2.5` while preserving danger styling.
- [x] Upgrade healthy details and print-only healthy summary to `rounded-xl border bg-background/50 p-3` while preserving `data-print-hidden` and `data-print-only`.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the ads route still renders.
- [x] Commit intentional files only.
