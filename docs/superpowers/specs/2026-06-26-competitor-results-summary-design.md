# Competitor results summary design

## Goal

Make the competitor analysis result summary feel like an executive SaaS insight header instead of a plain badge row.

## Scope

Update only the result summary card inside `components/dashboard-shell.tsx` in the `CompetitorSpyPanel` result branch.

Do not change analysis behavior, result parsing, provider selection, platform selection, ad fetching, routing, state, API calls, or any downstream result sections.

## Design

Upgrade the summary block shown after analysis:
- Keep provider, platform, and summary text visible.
- Place the result summary on a rounded insight surface with subtle border, background, and ambient accent.
- Add a concise localized label for the generated insight.
- Add small context chips for provider and platform so the evidence source remains clear.
- Keep the summary compact and readable, with the existing `compactText(result.summary, 260)` limit.

Preserve behavior exactly:
- `result.provider` remains displayed.
- `platformLabel(platform)` remains displayed.
- `compactText(result.summary, 260)` remains unchanged.
- Existing output sections for competitors, themes, gaps, briefs, and next actions remain unchanged.

## Accessibility

- Do not hide the summary text.
- Keep text contrast within existing token usage.
- Preserve the reading order: source context first, summary second.
- Do not add interactive controls.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify `/?view=competitor` still renders the competitor workspace and no-token first-run content.
