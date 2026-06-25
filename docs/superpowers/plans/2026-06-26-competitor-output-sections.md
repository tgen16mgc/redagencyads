# Competitor Output Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the competitor analysis output sections into structured SaaS insight cards.

**Architecture:** Keep the change contained to the result branch output in `CompetitorSpyPanel` inside `components/dashboard-shell.tsx`. Reuse existing data, copy, badges, CompactList, and print attributes. No new state, routes, dependencies, API calls, or behavior changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade competitor output section surfaces

**Files:**
- Modify: `components/dashboard-shell.tsx:2814-2886`
- Create: `docs/superpowers/specs/2026-06-26-competitor-output-sections-design.md`
- Create: `docs/superpowers/plans/2026-06-26-competitor-output-sections.md`

- [ ] Add localized section eyebrow to competitor profiles section.
- [ ] Upgrade all four outer containers from `rounded-lg` to `rounded-2xl` treatment.
- [ ] Upgrade all inner cards from `rounded-md border p-3` to `rounded-xl border bg-card/70 p-3 shadow-sm`.
- [ ] Preserve all data rendering, slice limits, compactText limits, line-clamp values, data-print-expand, and CompactList usage.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run `git diff --check` and expect no whitespace errors.
- [ ] Verify `/?view=competitor` renders the updated output sections.
- [ ] Commit intentional files only.
