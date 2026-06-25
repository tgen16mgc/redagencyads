# Sidebar Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the app sidebar so the shell reads like a branded SaaS workspace.

**Architecture:** Keep the change contained to `components/dashboard/app-sidebar.tsx`. Reuse existing sidebar primitives, props, icons, labels, handlers, and `cn`. No new state, routes, APIs, dependencies, or behavior changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova sidebar components, lucide-react icons already imported in `app-sidebar.tsx`.

---

### Task 1: Upgrade sidebar workspace identity and status surfaces

**Files:**
- Modify: `components/dashboard/app-sidebar.tsx:62-149`
- Create: `docs/superpowers/specs/2026-06-26-sidebar-workspace-design.md`
- Create: `docs/superpowers/plans/2026-06-26-sidebar-workspace.md`

- [ ] Replace the plain sidebar header menu button with a branded workspace identity block.
- [ ] Change top-level function menu buttons to `size="lg"` while preserving labels, handlers, active state, and tooltips.
- [ ] Replace the AI setup menu row with a small provider status card using the existing provider label.
- [ ] Polish the clear-session footer action without changing `onLogout`.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run the app and verify `/?view=competitor` renders the updated sidebar and existing no-token competitor content.
- [ ] Commit intentional files only.