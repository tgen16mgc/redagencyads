# Token Screen Design

## Goal

Make the token entry screen feel like a premium SaaS application entry point rather than a basic form.

## Scope

Update `TokenScreen` inside `components/dashboard-shell.tsx` (lines 1577-1718).
Do not change behavior, state, logic, error handling, languages, or routing. Keep existing props exactly as they are.

## Design

The current layout has a hero section on the left and a form card on the right, which is good. We need to upgrade the surface treatments to match the newly polished SaaS workspace.

### Grid Layout (lines 1599-1600)
- Current: `gap-6 md:min-h-[calc(100svh-3rem)] lg:grid-cols-[1.05fr_0.95fr]`
- Change to: `gap-8 md:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 py-4`
- Add a subtle background ambient gradient behind the main container (like `bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/30 via-background to-background`).

### Hero Section (Left side, lines 1601-1632)
- Current: `rounded-3xl border bg-card/60 p-6 shadow-2xl`
- Keep the dark card aesthetic, but increase border radius to `rounded-[2rem]`.
- Make it span full height of its grid container on desktop.
- Upgrade the 3 feature cards (secure, diagnostics, competitor) from `rounded-2xl` to `rounded-2xl bg-background/50 border-white/10 backdrop-blur-sm shadow-sm`.
- Enhance the radial gradients to be more distinct but subtle.

### Form Section (Right side, lines 1634-1715)
- Current: `Card` with `rounded-xl` (default)
- Upgrade to `rounded-3xl border-border/60 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur-xl p-2 md:p-4`.
- Move the `LanguageToggle` completely out of the card to the top right corner of the page (absolute positioning), so the card feels fully dedicated to authentication.
- Remove `CardHeader`/`CardContent` wrappers and replace with standard divs for finer control over padding.
- Upgrade the competitor spy button from `rounded-2xl border bg-background p-4` to `rounded-2xl border border-border/60 bg-muted/30 p-5 shadow-sm hover:bg-muted/60 hover:shadow-md`.

## Accessibility
- Preserve form structure, required fields, and onSubmit.
- Preserve all aria-labels.
- Keep contrast within existing tokens.

## Verification
- Run `npm run build`.
- Check no whitespace errors with `git diff --check`.
- Verify the TokenScreen UI visually.
