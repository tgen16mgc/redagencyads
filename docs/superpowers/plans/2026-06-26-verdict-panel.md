# Verdict Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `VerdictPanel` into the newer SaaS decision-card pattern.

**Architecture:** One visual-only edit in `VerdictPanel` in `components/dashboard-shell.tsx`. No behavior, state, API, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade VerdictPanel surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 2286-2391)

- [x] Replace the outer `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"` while preserving `data-print-break` and `data-print-flow`.
- [x] Replace `CardHeader` with a custom header using eyebrow, title, description, and right-side controls.
- [x] Preserve provider select, generate button, BorderGlow state, copy prompt button, and all handlers.
- [x] Replace `CardContent` with a plain body container.
- [x] Preserve `AiProgressStatus` and `VerdictCard` rendering exactly.
- [x] Upgrade empty state class from `border` to `rounded-xl border bg-background/50`.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the ads route still renders.
- [ ] Commit intentional files only.
