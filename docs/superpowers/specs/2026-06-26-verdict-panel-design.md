# Verdict Panel Design

## Goal

Make the `VerdictPanel` feel like a premium SaaS decision surface instead of a generic card with controls.

## Scope

Update only `VerdictPanel` inside `components/dashboard-shell.tsx` (around lines 2286-2391). Do not change provider selection behavior, generate/copy actions, loading progress, `VerdictCard`, or empty-state logic.

## Design

### Container Level
- Replace the outer `Card` wrapper with a custom `div` using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-break` and `data-print-flow` on the outer wrapper.
- Remove `CardHeader`, `CardTitle`, `CardDescription`, and `CardContent` wrappers for consistency with the newly polished panels.

### Header
- Add a localized eyebrow: `Decision Engine` / `Bộ máy quyết định`.
- Keep the visible title `Verdict`.
- Keep the existing localized description copy exactly.
- Place controls in a right-side `data-print-hidden` control cluster, preserving provider select, generate button, and copy prompt button.

### Body
- Keep `AiProgressStatus` rendering unchanged.
- Wrap the verdict/empty content in a visually calmer body area with spacing only; do not change `VerdictCard`.
- Upgrade the empty state surface from `Empty className="border"` to a softer `rounded-xl border bg-background/50` treatment via className.

## Accessibility

- Preserve all existing buttons and select labels.
- Preserve loading disabled states and `aria` behavior from existing controls.
- Do not add or remove interactive controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
