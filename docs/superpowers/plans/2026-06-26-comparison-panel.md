# Comparison Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the ComparisonPanel to match the SaaS card aesthetic.

**Architecture:** One visual-only edit in `ComparisonPanel` in `components/dashboard-shell.tsx`. No behavior or state changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade ComparisonPanel surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 2180-2232)

- [x] Wrap the section in `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5` instead of `Card`.
- [x] Implement the eyebrow/header pattern used in the other polished panels.
- [x] Upgrade the root causes container to `rounded-xl border bg-background/50 p-5`.
- [x] Upgrade individual driver item cards to `rounded-xl border bg-card/70 p-4 shadow-sm`.
- [x] Refine typography and list item spacing within the driver cards.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Commit intentional files only.
