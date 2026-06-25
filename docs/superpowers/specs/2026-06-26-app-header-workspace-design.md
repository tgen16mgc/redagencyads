# App header workspace design

## Goal

Make the authenticated/no-token app header feel like a SaaS workspace masthead instead of a utility row.

## Scope

Update only `components/dashboard-shell.tsx` inside the `DashboardShell` header render.

Do not change routing, active view state, language switching, session behavior, export behavior, sidebar behavior, or any API calls.

## Design

Upgrade the top header into a compact workspace masthead:
- Keep the sidebar trigger, Red Agency logo, current route title, language toggle, session badge, and export action.
- Place the header content on a rounded card surface with subtle border, background, and ambient accent.
- Keep existing breadcrumb/detail copy visible, but make it read as workspace context.
- Add one concise route description below the title so the current mode is immediately clear.
- Add a small mode badge for ads analysis or public research.

Preserve behavior exactly:
- `LanguageToggle` continues to receive the same props.
- The session badge continues to show authenticated/no-token status.
- The export button remains visible only for the ads view and remains disabled without a report.
- The sidebar trigger remains in the header.

## Accessibility

- Keep the header semantic `<header>` element.
- Preserve the logo alt text.
- Preserve all button handlers and disabled states.
- Do not hide the route title or current session state.
- Keep focus behavior from existing controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify `/?view=competitor` renders:
  - `Competitor spy`
  - `Public research`
  - `No token needed`
  - existing competitor setup and first-run content.
