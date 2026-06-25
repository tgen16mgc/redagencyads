# Insight Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `InsightPanel` into the newer SaaS insight-card pattern.

**Architecture:** One visual-only edit in `InsightPanel` in `components/dashboard-shell.tsx`. No behavior, state, API, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade InsightPanel surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 2394-2488)

- [x] Replace the outer `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"` while preserving `data-print-flow`.
- [x] Replace `CardHeader` with a custom header using eyebrow, title, description, and right-side generate control.
- [x] Preserve generate button loading/disabled behavior and handler.
- [x] Replace `CardContent` with a plain body container.
- [x] Preserve `AiProgressStatus`, insight row slicing, and row content rendering.
- [x] Upgrade the insight metadata strip to `rounded-xl border bg-background/50 p-4`.
- [x] Upgrade individual insight row cards to `rounded-xl border bg-card/70 p-4 shadow-sm`.
- [x] Upgrade empty state class from `border` to `rounded-xl border bg-background/50`.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the ads route still renders.
- [ ] Commit intentional files only.
