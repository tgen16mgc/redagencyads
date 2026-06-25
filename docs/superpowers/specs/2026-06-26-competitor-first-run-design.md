# Competitor first-run design

## Goal

Make the no-token competitor-spy screen feel like a guided SaaS workflow instead of an empty form plus blank analysis area.

## Scope

Update only the first-run empty state inside `CompetitorSpyPanel` in `components/dashboard-shell.tsx`.

Do not change competitor state, scraping behavior, AI calls, validation, provider selection, routing, or token/session logic.

## Design

When no competitor analysis exists yet, replace the plain `Empty` card in the right column with a structured guidance panel.

The panel should explain the workflow in three visible steps:
- Add competitor names or Meta Ad Library URLs.
- Fetch public ads or paste notes.
- Generate themes, gaps, briefs, and next actions.

Add lightweight SaaS credibility cues:
- Public research works without a token.
- Real ad-library notes improve confidence.
- Outputs are organized into themes, gaps, briefs, and next actions.

Keep `SpyAdsPanel` above the guidance panel so fetched ads and warnings remain visible before analysis.

## Accessibility

- Use semantic headings and ordered/list content where appropriate.
- Keep readable contrast using existing foreground, muted, border, and background tokens.
- Do not introduce new interactive controls.
- Do not remove the existing left-side form labels, descriptions, or buttons.

## Verification

- Run `npm run build`.
- Launch the app and verify `/?view=competitor` renders the new first-run panel.
- Confirm the existing competitor form fields and primary action text still render.
- Confirm the no-token route remains accessible.