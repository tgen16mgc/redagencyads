# Competitor Spy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `CompetitorSpy` into the newer SaaS competitive-intelligence workspace pattern.

**Architecture:** One visual-only edit in `components/dashboard-shell.tsx`. No behavior, state, API, fetch, form, select, result, ad preview, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade CompetitorSpy surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 2607-2994)

- [x] Replace the outer `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"` while preserving `data-print-flow`.
- [x] Replace `CardHeader` with a custom header using localized eyebrow, title, description, and right-side controls.
- [x] Preserve the existing visible title and description copy exactly.
- [x] Preserve generate and copy-prompt button loading/disabled behavior, handlers, icons, `aria-busy`, and `data-print-hidden`.
- [x] Replace `CardContent` with a plain body container using `mt-5 grid gap-4 xl:grid-cols-[380px_1fr]`.
- [x] Preserve the input column, field labels, descriptions, values, handlers, selects, textareas, and fetch-only button behavior exactly.
- [x] Upgrade the input column and advanced-options surfaces to the rounded SaaS pattern.
- [x] Preserve `SpyAdsPanel`, result branch, first-run branch, result row ordering, row slicing, badges, copy, and `data-print-expand` behavior.
- [x] Upgrade major custom result/first-run panels from `bg-background` to `bg-background/50` where no behavior is affected.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the competitor route still renders.
- [x] Commit intentional files only.
