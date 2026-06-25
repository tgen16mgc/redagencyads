# Comparison Panel Design

## Goal

Upgrade the `ComparisonPanel` to match the newly established premium SaaS aesthetic, transitioning from generic bordered sections to elevated `rounded-2xl` containers with `rounded-xl` internal data cards.

## Scope

Update only `ComparisonPanel` inside `components/dashboard-shell.tsx` (approx lines 2180-2232).
Do not alter any state, analysis logic, localization handling, or routing.

## Design

### Container Level
- Replace the outer `Card` wrapper with a standard `div` using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Remove `CardHeader`, `CardTitle`, `CardDescription`, and `CardContent`.
- Create a localized eyebrow: "Comparison Drivers" / "Động lực So sánh".
- Re-flow the title and description into the new header hierarchy (similar to `RunningAdSetsPanel`).

### Internal Content Container
- Update the root causes summary box from `rounded-lg border bg-muted/20 p-3` to `rounded-xl border bg-background/50 p-5 shadow-sm`.
- Convert the "Root-cause drivers" / "Nguyên nhân chính" label to a subtle uppercase eyebrow.
- Update the summary text to use better leading (`leading-relaxed`).
- Soften the driver status Badge using `backdrop-blur-sm` and custom transparency if appropriate, or keep standard variants.

### Driver Cards
- Update the driver item boxes from `rounded-md border bg-background p-3` to `rounded-xl border bg-card/70 p-4 shadow-sm`.
- Make the positive/negative badges feel more integrated (standard `destructive`/`secondary` variants still apply, but layout within the card should feel distinct).
- Convert the driver evidence list `ul` > `li` text from `text-xs` to a cleaner layout, possibly adding a subtle bullet mark or check icon.
- Replace the `Separator` with a more integrated border or subtle line separating the action text.

## Accessibility
- Preserve `language` handling.
- Maintain existing text contrast.

## Verification
- Run `npm run build`.
- Run `git diff --check`.
