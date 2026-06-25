# Competitor setup design

## Goal

Make the no-token competitor setup form feel like a guided SaaS research brief instead of a plain input stack.

## Scope

Update only `components/dashboard-shell.tsx` inside `CompetitorSpyPanel`.

Do not change routing, state, handlers, field values, fetch behavior, analysis behavior, provider selection, or API calls.

## Design

Upgrade the left setup column into a compact research brief panel:
- Add a small header with `Research brief` copy and a no-token badge.
- Add concise helper copy explaining that competitor names or Meta Ad Library URLs are enough to begin.
- Add a three-item prep checklist using existing completion booleans where possible.
- Keep the competitors and market fields visible as the primary brief inputs.
- Keep advanced options in the existing disclosure, but make it read as secondary configuration.
- Keep the fetch-only action inside advanced options.

Improve hierarchy without adding behavior:
- Use a rounded bordered surface with subtle background treatment.
- Keep field labels, descriptions, placeholders, handlers, and accessibility attributes intact.
- Preserve `details` keyboard behavior and the existing summary affordance.
- Preserve disabled/loading states for fetch and analysis buttons.

## Accessibility

- Keep all form controls associated with their existing labels.
- Keep `aria-describedby` connections for text help.
- Keep the advanced options disclosure as native `details`/`summary`.
- Do not hide meaningful text except through existing responsive/collapsed patterns.
- Maintain visible focus styles from the underlying controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Launch or reuse the local app and verify `/?view=competitor` renders:
  - `Research brief`
  - competitor and market inputs
  - `Advanced options`
  - existing no-token first-run content.
