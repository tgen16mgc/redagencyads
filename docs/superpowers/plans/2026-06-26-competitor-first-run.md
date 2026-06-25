# Competitor First-Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the no-token competitor-spy first-run state into a guided SaaS onboarding panel.

**Architecture:** Keep the change contained to `CompetitorSpyPanel` in `components/dashboard-shell.tsx`. Replace only the no-result empty state in the right column with static guidance copy and layout using existing components and icons. No new state, API calls, routes, dependencies, or behavior changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova UI components, lucide-react icons already imported in `dashboard-shell.tsx`.

---

### Task 1: Replace competitor blank state with guided first-run panel

**Files:**
- Modify: `components/dashboard-shell.tsx:2804-2817`
- Create: `docs/superpowers/specs/2026-06-26-competitor-first-run-design.md`
- Create: `docs/superpowers/plans/2026-06-26-competitor-first-run.md`

- [ ] Add localized first-run copy inside `CompetitorSpyPanel` after `const spyCopy = uiCopy[language].spy;`.
- [ ] Replace the no-result `Empty` block with a structured guidance panel.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run the app and verify `/?view=competitor` renders the new first-run panel while existing form controls remain visible.
- [ ] Commit intentional files only.