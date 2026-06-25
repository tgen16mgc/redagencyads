# Data Source Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the competitor fetched-ads panel into a clearer SaaS data-source evidence tray.

**Architecture:** Keep the change contained to `SpyAdsPanel` in `components/dashboard-shell.tsx`. Reuse existing props, copy object, warnings, ad rendering, snapshot handler, and print attributes. No new state, routes, dependencies, API calls, or behavior changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components, lucide-react icons already imported in `dashboard-shell.tsx`.

---

### Task 1: Upgrade competitor data-source panel hierarchy

**Files:**
- Modify: `components/dashboard-shell.tsx:2927-3009`
- Create: `docs/superpowers/specs/2026-06-26-data-source-panel-design.md`
- Create: `docs/superpowers/plans/2026-06-26-data-source-panel.md`

- [ ] Add a small `dataSourcePanel` view model inside `SpyAdsPanel` for localized labels and status text.
- [ ] Replace the plain fetched-ads wrapper with a rounded evidence tray surface.
- [ ] Add a public data-source badge and small state chips for ads count and latest sync.
- [ ] Preserve warning alerts and their current `warnings.slice(0, 3)` behavior.
- [ ] Polish the nested ad cards while preserving `ads.slice(0, 12)`, snapshot button behavior, image alt text, copy text, CTA, and start date.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run `git diff --check` and expect no whitespace errors.
- [ ] Verify `/?view=competitor` renders the updated panel and existing competitor content.
- [ ] Commit intentional files only.
