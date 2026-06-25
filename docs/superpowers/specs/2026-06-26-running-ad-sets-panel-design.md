# Running Ad Sets Panel Design

## Goal

Polish the "Running Ad Sets & Creatives" output section so it feels like a native SaaS insight card rather than a generic bordered container.

## Scope

Update only `RunningAdSetsPanel` inside `components/dashboard-shell.tsx` (lines ~1961-2122).
Do not change behavior, React state, loops, or the underlying iframe rendering `dangerouslySetInnerHTML`.

## Design

### Container Level
- Upgrade the outer `Card` wrapper from the default layout to an elevated container: `rounded-2xl border bg-card/70 shadow-sm`.
- Replace the `CardHeader`/`CardContent` components with custom layout to match the competitor workspace polish (e.g., standard `div` wrapper with padding).
- Add a localized section eyebrow (like "Ad Set Preview" / "Cấu trúc & Quảng cáo").
- Combine the title and description into the new visual hierarchy pattern.

### Ad Set Selection List (Left Column)
- Refine the sidebar area showing available Ad Sets.
- Change the selection buttons from `rounded-2xl` to `rounded-xl`.
- Enhance the selected state to use `bg-background shadow-sm border border-border/50` to pop out from the container.

### Ad Set Content & Previews (Right Column)
- Upgrade the inner display container from `rounded-xl border p-4 bg-muted/10` to `rounded-xl border bg-background/50 p-5`.
- Change the badge treatments to be slightly softer (e.g., `backdrop-blur-sm`).
- Upgrade the Creative selection toggle buttons to use modern segmented control styling or cleaner rounded tabs.
- The `dangerouslySetInnerHTML` block containing the iframe remains exactly as is.

## Accessibility
- Preserve the selection logic and click targets.
- Maintain existing text contrast.

## Verification
- Run `npm run build`.
- Run `git diff --check`.
