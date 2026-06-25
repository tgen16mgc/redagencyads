# Token Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the TokenScreen component to match the premium SaaS aesthetic.

**Architecture:** Visual design update in `components/dashboard-shell.tsx` only. No logic, dependency, or state changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade TokenScreen UI

**Files:**
- Modify: `components/dashboard-shell.tsx:1577-1725` (approximate)

- [x] Wrap the `main` with a subtle gradient background: `bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/30 via-background to-background`.
- [x] Make the grid layout more spacious and balanced: `lg:grid-cols-[1.1fr_0.9fr] lg:gap-12`.
- [x] Move `LanguageToggle` to an absolute container in the top right corner of the `main` tag.
- [x] Upgrade the left Hero section to `rounded-[2rem]` with refined backdrop cards for the 3 feature highlights.
- [x] Upgrade the right Form section to `rounded-[2rem] border-border/60 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur-xl p-6 sm:p-8`.
- [x] Remove `Card`, `CardHeader`, `CardContent`, etc., and replace with native div layout inside the Form section to allow custom `rounded-[2rem]`.
- [x] Upgrade the Competitor Spy shortcut button to `rounded-2xl border-border/60 bg-muted/30 p-5 shadow-sm`.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Commit intentional files only.
