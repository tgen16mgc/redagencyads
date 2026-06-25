# Loading Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the initial loading screen into a branded SaaS loading state.

**Architecture:** One visual-only edit in `LoadingScreen` in `components/dashboard-shell.tsx`. No behavior, state, route, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade LoadingScreen surface

**Files:**
- Modify: `components/dashboard-shell.tsx:1720-1735`

- [x] Replace the plain centered `Card` wrapper with a radial-background `main` and a custom elevated card.
- [x] Add Red Agency logo/product identity above the loading copy.
- [x] Preserve `copy.title` and `copy.description`.
- [x] Add `role="status"` and `aria-live="polite"` to the loading surface.
- [x] Replace the single skeleton block with three stacked dashboard-like skeleton rows.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify route rendering still succeeds.
- [x] Commit intentional files only.
