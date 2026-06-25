# Running Ad Sets Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the RunningAdSetsPanel to match the newly established 2xl/xl SaaS card aesthetic.

**Architecture:** One visual-only edit in `RunningAdSetsPanel` in `components/dashboard-shell.tsx`. No behavior or state changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade RunningAdSetsPanel surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 1961-2122)

- [x] Wrap the entire section in `rounded-2xl border bg-card/70 p-4 shadow-sm` instead of the generic `Card`.
- [x] Add the section eyebrow and convert header into the updated visual style.
- [x] Update the Ad Set selection sidebar (left col) to use `rounded-xl` with an elevated selected state.
- [x] Update the Ad Set content area (right col) to `rounded-xl border bg-background/50 p-5`.
- [x] Update the Creative selection tabs to use softer, native-feeling pill buttons.
- [x] Leave the actual ad preview iframe `div` alone to preserve functionality.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Commit intentional files only.
