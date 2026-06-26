# Creative Volume Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `CreativeVolumeCard` into the newer SaaS creative-capacity diagnostic card pattern.

**Architecture:** One visual-only edit in `components/dashboard-shell.tsx`. No behavior, state, API, creative volume assessment, filtering, fallback display, badge, diagnostic tone, print, or data changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components.

---

### Task 1: Upgrade CreativeVolumeCard surface

**Files:**
- Modify: `components/dashboard-shell.tsx` (around lines 4108-4146)

- [x] Replace the outer `Card` with `div className="rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5"` while preserving `data-print-flow`.
- [x] Preserve diagnostic accent styling by keeping `diagnosticAccentClass(assessment.variant)` on the outer wrapper.
- [x] Replace `CardHeader` with a custom header using localized eyebrow, title, description, and badge.
- [x] Preserve existing visible title and description copy exactly.
- [x] Preserve assessment badge rendering and variant exactly.
- [x] Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- [x] Wrap the assessment summary paragraph in `rounded-xl border bg-background/50 p-4`.
- [x] Preserve `displayAdsets` ordering, fallback logic, row name, count badge, reason copy, and `DiagnosticNextStep` rendering.
- [x] Upgrade ad set rows to `rounded-xl border bg-background/50 px-3 py-2.5` while preserving row content.
- [x] Run `npm run build` and expect exit code 0.
- [x] Run `git diff --check` and expect no whitespace errors.
- [x] Verify the ads route still renders.
- [ ] Commit intentional files only.
