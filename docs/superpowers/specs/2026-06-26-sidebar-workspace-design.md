# Sidebar workspace design

## Goal

Make the authenticated/no-token app shell feel like a branded SaaS workspace instead of a default utility sidebar.

## Scope

Update only `components/dashboard/app-sidebar.tsx`.

Do not change routing, active-view state, workflow state, session handling, logout behavior, provider selection, or any API calls.

## Design

Upgrade the sidebar header into a compact workspace identity block:
- Keep the Red Agency logo.
- Show `Red Agency` as the workspace name and `Ads intelligence` as the product context.
- Add subtle border, card surface, and collapse-safe classes so icon mode still works.

Improve the functions menu hierarchy:
- Use larger sidebar buttons for top-level functions.
- Preserve current active state, click handlers, labels, icons, and aria-current behavior.

Improve the AI setup/status area:
- Present provider status as a small bordered status card.
- Keep the existing provider label and Sparkles icon.
- Add concise status copy so it reads like a connected workspace module.

Improve the footer:
- Keep the existing logout handler and label.
- Use a bordered danger-leaning action surface that remains clear but not visually loud.

## Accessibility

- Keep all navigation controls as buttons.
- Preserve `aria-current` on active navigation and workflow steps.
- Preserve tooltips for collapsed sidebar mode.
- Do not hide meaningful text except with existing collapsed-sidebar utility classes.
- Keep focus styles from `SidebarMenuButton`.

## Verification

- Run `npm run build`.
- Launch the app and verify `/?view=competitor` renders the updated sidebar shell without a token.
- Confirm the app function labels, AI provider label, and no-token competitor content still render.