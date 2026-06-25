# Competitor Results Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the competitor result summary into an executive insight header.

**Architecture:** Keep the change contained to the `result ?` branch in `CompetitorSpyPanel` inside `components/dashboard-shell.tsx`. Reuse existing `result.provider`, `platformLabel(platform)`, `result.summary`, `compactText`, language state, badges, and layout primitives. No new state, routes, dependencies, API calls, or behavior changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade competitor result summary surface

**Files:**
- Modify: `components/dashboard-shell.tsx:2793-2802`
- Create: `docs/superpowers/specs/2026-06-26-competitor-results-summary-design.md`
- Create: `docs/superpowers/plans/2026-06-26-competitor-results-summary.md`

- [ ] Replace the plain result summary badge row with a rounded insight summary surface.
- [ ] Preserve `result.provider`, `platformLabel(platform)`, and `compactText(result.summary, 260)`.
- [ ] Add localized title and description copy using existing `isVietnamese`.
- [ ] Keep all downstream competitor, theme, gap, brief, and next-action sections unchanged.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run `git diff --check` and expect no whitespace errors.
- [ ] Verify `/?view=competitor` still renders existing competitor workspace content.
- [ ] Commit intentional files only.
