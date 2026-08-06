# Homepage and Performance Diagnosis Research, Audit, and UX Specification

Date: 2026-08-05
Scope: public homepage, workspace entry, Performance Diagnosis, global search, notifications, and open registration
Product frame: paid-media Decision Operations Workspace, not a generic AI dashboard

## Research first: market and user evidence

### Jobs to be done

| Job | Evidence | Confidence | Product implication |
| --- | --- | --- | --- |
| Know what needs attention before opening several reports | Madgicx repeatedly positions clarity, structured insights, and "exactly what to do next"; Northbeam is described as the first daily check for operators and executives | High | Lead the dashboard with the highest-impact exception and its readiness state |
| Understand why performance changed, not only that it changed | Triple Whale says "Know what's working. See what's not. Understand why"; the existing repo research captures the same request from paid-media operators | High | Keep diagnosis, causal evidence, and the next action in one path |
| Make a defensible budget decision without destabilizing delivery | Existing product rules cap one budget move at 20%; market language emphasizes profitable growth and reducing wasted spend | High | Show the guardrail beside the recommendation and require review before application |
| Answer client questions without rebuilding a dashboard or wrangling CSVs | A 2025 agency-focused Hacker News post describes hours spent in spreadsheets, repetitive dashboards, and scrambling during client calls | Medium | Make search span accounts, campaigns, evidence, and actions; preserve export as a first-class outcome |
| Get useful signal without alert fatigue or excessive complexity | Existing customer research in `docs/product-plan-2026-06-16.md` says alerts must be quiet and dashboards must explain "so what" | High | Notifications must be derived from current readiness, health, and data state; no decorative notifications |
| Start evaluating the product without waiting for an invitation | Madgicx and Motion use direct free-trial/get-started conversion paths; the current homepage only offers login | Medium | Add open account creation and make it the primary conversion path |

### Voice of customer

- "Tell me WHY, not just what." - paid-media research already captured in `docs/product-plan-2026-06-16.md`
- "ROAS down 19%, spent an hour figuring out why." - paid-media research already captured in `docs/product-plan-2026-06-16.md`
- "Alerts are only good if they're quiet." - paid-media research already captured in `docs/product-plan-2026-06-16.md`
- "spending hours in spreadsheets, building repetitive dashboards, and scrambling to answer ad-hoc questions during client calls" - Hacker News agency workflow post, 2025-09-29
- "balancing simplicity vs power - not overwhelming non-technical users" - Hacker News agency workflow post, 2025-09-29
- "clarity to campaign performance at scale" and "actionable insights quickly ... without getting lost in complex data" - Madgicx homepage customer quotes, accessed 2026-08-05
- "I check in every day. Our CFO checks in. Our CEO checks in. It's the first look of the day for all of us." - Northbeam homepage customer quote, accessed 2026-08-05

### Market patterns applied

| Pattern | Market evidence | Application here |
| --- | --- | --- |
| Outcome-first promise | Madgicx: audit the account and say what to do next; Northbeam: profitable growth | Homepage promise becomes a concrete daily decision outcome |
| Product proof near the hero | Madgicx, Triple Whale, Motion, and Northbeam place product proof close to the primary promise | Keep the live workspace preview, but pair it with a faster registration path |
| One source of truth | Triple Whale explicitly positions against scattered and inaccurate data | Search and notifications operate across the same canonical workspace state |
| Creative and tactical explainability | Motion emphasizes identifying which creatives work; Northbeam emphasizes tactical attribution | Performance Diagnosis keeps creative, entity, funnel, and evidence paths connected |
| Direct conversion path | Madgicx and Motion expose free-trial/get-started calls to action | Replace login-only conversion with Create account plus secondary Log in |
| Daily operating ritual | Northbeam's customer quote describes a cross-functional first look of the day | Overview and notifications prioritize what changed since the last check |

### Research limitations

- G2, Capterra, Trustpilot, current Reddit JSON, and general search-result pages returned access challenges or 403 responses in this environment.
- Market evidence is therefore weighted toward official vendor pages plus the repository's existing operator research and one public Hacker News workflow post.
- The TripleWhale iOS listing currently reports about 2.61/5 from 31 ratings. This is a small, mobile-skewed sample and is treated only as a low-confidence signal that reliability and mobile workflow quality matter.
- The seven reference images supplied from `/Users/tienduonn/Downloads/` are not present in this Ubuntu workspace, so direct visual comparison remains unverified.

## Current user flows

### Public acquisition

```text
Homepage
  -> read long product story
  -> click Log in
  -> sign-in screen
  -> request invitation if no account
```

Primary break: the homepage promises a product that new visitors cannot start using. Every major call to action is login-only.

### Performance diagnosis

```text
Workspace entry
  -> connect Meta or open sample
  -> choose account/campaign/date/KPI pack
  -> load report
  -> scan Overview
  -> open Funnel / Drivers / Creatives / Evidence
  -> generate or review Verdict
  -> export or apply a guarded action
```

Primary break: the screen contains the right evidence and controls, but the top of the page still asks the user to interpret several parallel cards before the highest-impact exception and next action become obvious.

### Header utilities

```text
Search icon -> "coming next" toast
Notification icon -> "no new notifications" toast
```

Primary break: visible controls promise global utilities but do not perform a task.

## New user flow and UX prototype

### Acquisition and registration

```text
Homepage
  -> Create free account
  -> name + email + password + terms
  -> Supabase sign-up
       -> session available: active viewer membership -> workspace
       -> email confirmation required: confirmation state -> sign in after confirmation
  -> Overview with sample decision pulse
  -> Connect Meta when owned performance is needed
```

### Daily decision loop

```text
Open workspace
  -> notification summary says what changed
  -> Performance Diagnosis opens on the primary constraint
  -> review evidence and confidence
  -> inspect affected entity / funnel stage / creative
  -> review guarded action
  -> export or move to the next controlled operation
```

### Global search

```text
Cmd/Ctrl+K or Search button
  -> type account, campaign, workspace, or action
  -> grouped real results
  -> choose result
       -> navigate to workspace
       -> open settings / assistant / report action
       -> move to Performance with the matching entity context preserved where available
```

### Notification center

```text
Bell
  -> urgent blockers
  -> items requiring review
  -> connection/data-quality notices
  -> open item -> relevant workspace
  -> mark one or all read
```

Only current application state may produce a notification. No static "sample" notification is allowed in an authenticated production workspace.

## UX QA before UI implementation

The proposed flow passes these checks:

- One primary action per context: Create account on acquisition; Review action in Performance Diagnosis.
- Every diagnosis maintains a path to evidence before a budget or publishing action.
- Search results are honest: destinations and entities must exist in loaded state.
- Notifications are quiet by construction: only blockers, warnings, setup gaps, or meaningful readiness changes appear.
- Open registration grants the lowest role (`viewer`) and never overwrites existing owner/admin/analyst roles.
- Missing data remains missing; the design does not fabricate certainty or notification urgency.
- Mobile order preserves decision -> evidence -> action, with controls wrapping below the decision rather than competing with it.

## DESIGN AUDIT RESULTS

Overall Assessment: The current product has unusually strong diagnosis logic and a coherent visual system, but acquisition is closed, header utilities are fake, and the Performance overview still distributes attention across too many equal-weight surfaces. The redesign should make the interface feel like a daily decision instrument: exception first, evidence second, guarded action third.

---

## PHASE 1 - Critical

- Homepage conversion: every primary CTA says Log in -> make Create account the primary CTA and Log in secondary -> visitors can enter the product without an invitation dead end.
- Header search: a visible global control opens a placeholder toast -> open a keyboard-accessible HeroUI command modal with real destinations, entities, and actions -> the control fulfills its promise and reduces navigation cost.
- Header notifications: the bell always says no notifications -> show a HeroUI popover derived from current health, readiness, and connection state -> users can begin with the most important exception.
- Registration: authenticated users require a pre-existing invite -> assign every new user an active viewer membership while preserving privileged existing roles -> open access works without weakening role boundaries.
- Performance hierarchy: decision, readiness, funnel, trend, and actions compete above the fold -> establish one primary constraint card with evidence and guarded next action, then demote supporting metrics -> the screen answers "what should I do now" within two seconds.
- Mobile top bar: low-priority controls crowd the header -> preserve search, notifications, language, and account access with compact responsive behavior -> core utilities remain reachable without overlap.

Review: These issues either block entry, present non-functional controls, or force users to reconstruct the product's core conclusion themselves.

---

## PHASE 2 - Refinement

- Homepage narrative: the page repeats evidence, output, and login concepts across a long journey -> compress the middle into problem, proof, workflow, and use cases -> the value becomes legible before scroll fatigue.
- Homepage persona clarity: copy speaks broadly to paid media -> name the agency/operator workflow and client-defense outcome -> the intended buyer recognizes the product faster.
- Performance scope controls: account, date, comparison, and KPI controls read as unrelated pills -> group them under a single scope rail with consistent affordances -> users understand they jointly define the diagnosis.
- Performance evidence labels: mixed English/Vietnamese technical labels and raw status details compete with the conclusion -> align labels to the global interface language while preserving raw source names -> bilingual behavior stays coherent.
- Action readiness: pass/watch/block counts are visible but not sequenced -> show blockers first, then the next evidence check, then the guarded action -> users move through a deterministic review order.

Review: These changes reduce interpretation cost after the critical flow is functional.

---

## PHASE 3 - Polish

- Search empty state: provide query guidance and shortcuts instead of an empty list.
- Notification state: persist read IDs locally, announce unread count accessibly, and provide a clear mark-all-read action.
- Registration completion: distinguish immediate access from email-confirmation-required state and keep the entered email visible.
- Loading and errors: use stable skeleton/alert regions so header utilities and diagnosis layout do not jump.
- Motion: use one modal/popover entrance and one page reveal pattern, with reduced-motion support.

Review: These details do not change the model, but they make the completed flow feel reliable and production-ready.

---

## DESIGN_SYSTEM UPDATES REQUIRED

- Import `@heroui/styles` after Tailwind so HeroUI v3 components use their intended accessible states.
- Add command-surface tokens/classes for modal width, grouped result rows, keyboard hints, and empty results using existing background, border, primary, muted, and radius tokens.
- Add notification severity classes derived from existing `--destructive`, `--warning`, `--info`, and `--success` tokens.
- Add a primary-constraint treatment using the existing panel, border, primary, warning, and success tokens; no new raw colors.

---

## IMPLEMENTATION NOTES FOR BUILD AGENT

- `app/globals.css`: import HeroUI styles immediately after Tailwind; add command and notification classes using existing CSS variables.
- `components/dashboard-shell.tsx`: replace placeholder search/notification handlers with controlled HeroUI surfaces; expose them in every workspace, not overview only.
- `components/dashboard/workspace-command-center.tsx`: build controlled `Modal.Backdrop` + `SearchField` + grouped `ListBox`, and `Popover` notification center; support Cmd/Ctrl+K and `/` outside editable fields.
- `app/api/workspace/register/route.ts`: validate name/email/password, call Supabase sign-up with a safe confirmation redirect, and return either an authenticated workspace status or confirmation-required state.
- `supabase/migrations/*_workspace_open_registration.sql`: update the auth-user trigger so new users join `decision-workspace` as active viewers; preserve existing elevated roles and invite-specific roles.
- `components/workspace-auth.tsx`: replace request-access flow with HeroUI v3 registration fields, validation, terms acceptance, and confirmation state.
- `app/landing/page.tsx`: use `/?auth=register` for primary CTAs and keep Log in as the secondary path.
- `components/dashboard/performance-v2.tsx`: place the primary constraint, its evidence summary, and guarded next action in one dominant top surface; retain all existing tabs and underlying report logic.

## Acceptance criteria

### Registration

- Anyone can create an account when Supabase auth is configured.
- New accounts receive active viewer membership in `decision-workspace` without an invite.
- Existing owner/admin/analyst memberships are not downgraded when profile metadata changes.
- Email confirmation and immediate-session Supabase configurations both produce correct UI states.
- Password, email, name, confirmation, and terms validation are accessible and server-validated.

### Search

- Search opens from the header and Cmd/Ctrl+K; `/` opens it when focus is not in an editable control.
- Results include real workspace destinations, loaded accounts/campaigns/entities, and available actions.
- Selecting a result performs navigation or the named action; no result is decorative.
- Escape closes the modal and focus returns to the trigger.
- Empty queries and no-result queries provide useful guidance.

### Notifications

- Items are derived from current report health, capability, connection, or review state.
- Unread count is announced and displayed without relying on color alone.
- Opening an item marks it read and navigates to the relevant workspace.
- Mark all read persists for the current browser.
- A genuinely healthy/no-action state says so without fabricating activity.

### Homepage and Performance Diagnosis

- Homepage exposes Create account above the fold on desktop and mobile.
- The value proposition and live product proof remain visible without copy overlap.
- Performance Diagnosis makes the highest-impact constraint, evidence, and guarded action the dominant first scan.
- Existing tabs, export, scope controls, comparison, Verdict, and evidence paths remain functional.
- Desktop, tablet, and mobile renders have no clipping, overlap, horizontal page overflow, or inaccessible controls.

## Sources

- https://madgicx.com/
- https://www.triplewhale.com/
- https://motionapp.com/
- https://www.northbeam.io/
- https://itunes.apple.com/lookup?id=1511861727
- https://hn.algolia.com/api/v1/search?query=marketing%20agency%20dashboard%20CSV&tags=comment
- `docs/product-plan-2026-06-16.md`
- `CONTEXT.md`
- `README.md`
