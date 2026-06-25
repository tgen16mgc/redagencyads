# Entry Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the unauthenticated entry screen into a credible SaaS onboarding surface while preserving the existing token and competitor-spy flows.

**Architecture:** Keep the change contained to `TokenScreen` in `components/dashboard-shell.tsx`. Reuse existing shadcn/base-nova components, design tokens, language state, and event handlers. No new state, API calls, routes, or dependencies.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova UI components, lucide-react icons already imported in `dashboard-shell.tsx`.

---

### Task 1: Replace bare token card with split onboarding layout

**Files:**
- Modify: `components/dashboard-shell.tsx:1559-1654`
- Reference: `docs/superpowers/specs/2026-06-26-entry-onboarding-design.md`

- [ ] Add localized entry copy inside `TokenScreen`.
- [ ] Replace the returned JSX for `TokenScreen` with a responsive split layout.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run the app and manually verify desktop, mobile, token input, and competitor-spy route.
- [ ] Commit intentional files only.
