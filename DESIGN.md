---
version: 1.0
status: locked
name: Decision Operations Workbench
stack: shadcn-base-nova
---

# Decision Operations Workbench

This is an operational application, not a marketing site. The interface helps users move from source evidence to a reviewed decision and then to a tracked action. Density, truth, and recovery take priority over decoration.

## Foundation

- Use shadcn/ui `base-nova` components with Base UI primitives, Tailwind v4, Lucide icons, and semantic CSS tokens.
- Geist is the only product typeface. Use tabular figures for metrics and IDs.
- The current product is dark-only. Graphite surfaces create hierarchy without pure-black voids or large atmospheric backgrounds.
- Use a 4px spacing unit. Preferred increments are 4, 8, 12, 16, 24, 32, and 40px.
- Default corner radius is 12px. Pills are reserved for compact controls, statuses, and the sticky action rail.
- Astryx, legacy agency branding, marketing-style gradients, poster typography, and ornamental card grids are retired.

## Color System

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | `--background` | `#0c0d0f` | Application background |
| Surface | `--card` | `#131519` | Primary work surfaces |
| Raised surface | `--popover` | `#16181d` | Menus, sheets, popovers |
| Foreground | `--foreground` | `#f4f4f5` | Primary text |
| Muted | `--muted-foreground` | `#9ca3af` | Supporting text |
| Border | `--border` | `#2a2f37` | Structural dividers |
| Signal blue | `--primary` | `#2f8cff` | Primary actions and current selection |
| Success | `--success` | `#32d583` | Verified, healthy, completed |
| Warning | `--warning` | `#f5b940` | Degraded, review needed |
| Destructive | `--destructive` | `#ff5c6c` | Failure and destructive action |
| Information | `--info` | `#56a5ff` | Neutral system information |

Never use semantic colors to decorate a section. Color must communicate state, selection, or action.
Signal-blue fills use the dark `--primary-foreground` token so compact button text meets contrast requirements.

## Typography

- Page title: 24-30px, weight 600, tight but readable tracking.
- Section title: 16-18px, weight 600.
- Body and controls: 14px; dense tables may use 13px.
- Supporting text: 12-13px with `text-muted-foreground`.
- Metrics: 24-36px, weight 600, tabular figures. Always pair a number with a label and comparison context.
- Do not place an uppercase eyebrow above every title. Use a short status label only when it adds information.

## Workbench Structure

The application shell contains a route-aware sidebar, a compact workspace header, and one primary work surface. Routes represent durable jobs rather than local tab state.

```text
Client workspace
  Overview and decisions
  Performance
  Intelligence
  Publishing
  Evidence library
  Connections and capabilities
```

- Prefer one bordered work surface with internal separators over nested cards.
- Use `Table` for comparable records, `Tabs` for alternate views of the same object, and `Collapsible` or `Accordion` for supporting evidence.
- Use `Sheet` for record detail and evidence review without losing list context.
- Keep healthy or secondary diagnostics collapsed. Rank blockers and actions first.
- Empty states must explain what is missing, why it matters, and the next available action.

## Sticky Action Rail

The sticky pill is the persistent control surface for the current workflow. It should feel alive because it reflects state, not because it constantly animates.

- Show the current workflow stage, one primary action, and at most two secondary controls.
- Update its label and available actions as the user moves through setup, validation, review, output, and follow-up.
- Allow expansion into a compact action tray for recent runs, blockers, and keyboard shortcuts.
- Use the signal-blue glow only around the enabled primary action when user input is valid and an action is ready.
- Remove the glow while loading, disabled, degraded, or complete. Communicate those states with text, icon, and progress—not color alone.
- Keep it reachable above mobile safe areas and prevent it from covering tables, dialogs, or report content.

The glow token is `shadow-action-glow`. It is an action affordance, never a container treatment or ambient background.

## Component Rules

- Start with installed shadcn components. Compose before creating custom primitives.
- Primary action: default `Button`; secondary action: `outline` or `ghost`; destructive action: `destructive` plus confirmation.
- Use `Badge` only for compact status or provenance. Do not turn metadata into a row of decorative pills.
- Use `Alert` for actionable system conditions and `Empty` for no-result states.
- Use `Skeleton` or `Spinner` for loading and Sonner for transient confirmation.
- Forms use `FieldGroup` and `Field`; validation appears beside the affected control.
- Dialogs, sheets, and drawers require accessible titles. Icon-only controls require labels and tooltips.
- Avoid card-in-card composition, repeated introductions, glow borders on passive content, and custom markup that duplicates a shadcn component.

## Motion And Glow

- Motion explains state change: route entry, evidence arrival, action completion, or tray expansion.
- Keep transitions between 150 and 250ms. Use one staggered reveal per route at most.
- Respect `prefers-reduced-motion`; the interface remains fully legible without animation.
- The existing custom border glow may remain for a small number of high-value interactive controls. It must use signal blue and follow the sticky action rail rules.

## Responsive Behavior

- Desktop emphasizes persistent context and dense comparison.
- Mobile uses a closing route drawer, a compact header, stacked decision blocks, and horizontally scrollable data tables.
- Selecting a mobile route closes navigation and preserves the correct active state.
- Primary actions remain visible without obscuring content at 375px width.

## Accessibility And Trust

- Maintain visible focus rings, keyboard access, semantic headings, and WCAG AA text contrast.
- Every generated output discloses its provider and fallback state.
- Every evidence-backed claim links to provenance, freshness, and review status.
- Disabled actions state the exact missing requirement nearby.
- Never present unavailable, degraded, or zero-data capabilities as successful.

## Review Gate

Before shipping a screen, confirm:

1. The primary job and next action are obvious within five seconds.
2. The page has one dominant work surface and no redundant introduction.
3. Evidence, provider, and capability states are truthful.
4. Status color and glow communicate meaning rather than decoration.
5. Keyboard, reduced-motion, 375px mobile, and print behavior still work.
