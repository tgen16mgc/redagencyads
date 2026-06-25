# Competitor Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the no-token competitor setup form into a guided research brief panel.

**Architecture:** Keep the change contained to `components/dashboard-shell.tsx` inside `CompetitorSpyPanel`. Reuse existing state, booleans, labels, form controls, buttons, badges, icons, and handlers. No new routes, API calls, state, dependencies, or behavior changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components, lucide-react icons already imported in `dashboard-shell.tsx`.

---

### Task 1: Upgrade competitor setup form hierarchy

**Files:**
- Modify: `components/dashboard-shell.tsx:2505-2729`
- Create: `docs/superpowers/specs/2026-06-26-competitor-setup-design.md`
- Create: `docs/superpowers/plans/2026-06-26-competitor-setup.md`

- [ ] Add localized research brief copy near the existing `firstRun` copy.
- [ ] Replace the plain left setup wrapper with a rounded research brief panel header.
- [ ] Add a small prep checklist using existing `hasCompetitors`, `hasLibraryUrls`, and `notes` state.
- [ ] Preserve all visible fields, labels, placeholders, handlers, values, `aria-describedby`, and button states.
- [ ] Keep advanced options inside native `details`/`summary`.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run `git diff --check` and expect no whitespace errors.
- [ ] Verify `/?view=competitor` renders the updated setup panel and existing first-run content.
- [ ] Commit intentional files only.
