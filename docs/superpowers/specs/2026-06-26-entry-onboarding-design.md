# Entry onboarding design

## Goal

Make the first screen feel like a credible SaaS product instead of a bare token gate, while preserving the existing Meta token flow and competitor-spy shortcut.

## Scope

Update only the unauthenticated `TokenScreen` UI in `components/dashboard-shell.tsx`.

Do not change authentication logic, session handling, API calls, language state, or competitor-spy routing.

## Design

Use a responsive two-column onboarding layout on desktop and a single-column stack on mobile.

Left column:
- Show the Red Agency logo, product name, and a stronger headline for campaign-first Meta Ads analysis.
- Add concise supporting copy explaining that users can connect Meta data, read KPIs, generate verdicts, and export/share insights.
- Add three trust/value cards: secure token session, campaign-first diagnostics, and no-token competitor research.
- Add a small privacy/security note using existing token-session language.

Right column:
- Keep the existing access-token form with the same submit behavior and loading state.
- Clarify the primary path with direct copy: connect a Meta access token to analyze owned ad accounts.
- Keep the competitor-spy path as a secondary card-style action with improved visual hierarchy.
- Preserve English/Vietnamese copy support.

## Accessibility

- Keep the form label, required input, and password field.
- Keep the competitor action as a real button with an aria-label.
- Ensure keyboard focus is visible via existing focus ring utilities.
- Maintain readable text contrast using current design tokens.

## Verification

- Run type/build verification.
- Launch the app and visually verify the unauthenticated entry screen at desktop and mobile widths.
- Confirm the token form still accepts input and the competitor-spy button switches to the competitor view.
