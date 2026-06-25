# App Header Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the app-level header into a branded SaaS workspace masthead.

**Architecture:** Keep the change contained to the `DashboardShell` header JSX in `components/dashboard-shell.tsx`. Reuse existing copy, active-view state, controls, badges, icons, and handlers. No new routes, APIs, dependencies, state, or behavior changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components, lucide-react icons already imported in `dashboard-shell.tsx`.

---

### Task 1: Upgrade app header workspace surface

**Files:**
- Modify: `components/dashboard-shell.tsx:1003-1031`
- Create: `docs/superpowers/specs/2026-06-26-app-header-workspace-design.md`
- Create: `docs/superpowers/plans/2026-06-26-app-header-workspace.md`

- [ ] Add a small `headerMode` view model near the existing navigation view models.
- [ ] Replace the plain top header row with a rounded workspace masthead surface.
- [ ] Preserve sidebar trigger, logo, title, language toggle, session badge, pulled-at badge, and export button behavior.
- [ ] Add concise view-specific description and mode badge.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run `git diff --check` and expect no whitespace errors.
- [ ] Verify `/?view=competitor` renders the updated header and existing competitor content.
- [ ] Commit intentional files only.
