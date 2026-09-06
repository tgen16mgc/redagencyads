# Meta analytics product audit

Direction: a compact report workspace centered on real performance data. Preserve the existing Next.js, Meta API, Supabase, comparison, and export infrastructure.

## Feature decisions

| Feature / component | Classification | Decision |
| --- | --- | --- |
| Meta authentication, accounts, campaign scope | KEEP | Essential data access. Keep credentials on the server. |
| Workspace authentication, membership, settings | KEEP | Preserve existing access controls. |
| Report fetching and saved reports | KEEP / IMPROVE | Home focuses on new, current, and saved reports. |
| Workspace overview / command center | MERGE | Replace its dashboard cards with the report entry screen; performance lives in the report. |
| Performance overview | IMPROVE | Spend-first KPI strip, timeline, entity table. Remove health-score hero and action cards. |
| Evidence table | BROKEN / IMPROVE | Remove inferred Active labels; add search, sorting, pagination, entity inspection, and drilldown. |
| Period comparison | KEEP / IMPROVE | Preserve existing scope and comparison calculations. Reject invalid dates and non-finite display values. |
| Funnel and performance drivers | KEEP | Retain as secondary diagnostic tabs with underlying evidence. |
| Entity campaign / ad set / ad rows | KEEP | Table levels and parent-to-child inspection support the core job. |
| CSV and report export | KEEP | CSV exports filtered and sorted rows across all pages. Existing report export remains. |
| Custom chart and KPI builders | REMOVE from primary report | Remove the builder entry points and custom-chart controller mount. Preserve stored settings. |
| AI verdict generation | REMOVE from automatic report lifecycle | Reports no longer trigger an AI request. Remove verdict/action hero and review CTA. |
| AI assistant launcher | REMOVE from navigation | Remove sidebar/mobile launcher and command-search entry. |
| Campaign setup and creative gallery | MERGE / REMOVE from primary tabs | Use campaign/ad data in the main table; retain existing implementations for compatibility. |
| Competitor evidence | KEEP separately | Independent research workspace; never mix public competitor observations with account results. |
| TikTok, publishing, cross-channel Intelligence | REMOVE from primary navigation | Preserve existing direct-link routes and backend services. |
| Intelligence creative lab, experiments, budgets, connectors, AI system | REMOVE from primary navigation | Operational extensions sit outside the core Meta report journey. No backend deletion. |
| Sample report | KEEP, explicitly labeled | Only user-selected sample mode; never represented as live account performance. |
| Shared surfaces and controls | IMPROVE | Small radii, neutral surfaces, restrained borders, tabular numbers, visible keyboard focus. |

## Confirmed defects addressed

- Undated table rows incorrectly displayed Active regardless of delivery status.
- Invalid and reversed reporting dates were accepted by date helpers; malformed date input could throw. Report API now rejects impossible/reversed dates before upstream work.
- Non-finite metrics could display as zero or Infinity. Analytics formatting preserves zero while rendering invalid values as unavailable.
- Zero-result cost displayed as a genuine zero. Table and timeline now show unavailable cost when there is no denominator.
- Table lacked search, sorting, useful pagination, and direct entity inspection.
- Timeline hid the second scale and trusted input date order. Both scales are visible and dates are sorted.
- Reports automatically started AI verdict requests before the user asked for them.

## Validation scope

Targeted unit tests cover analytics filtering, untracked outcomes, sorting, formatting, invalid dates, comparisons, and existing performance display/access behavior. A route test verifies invalid dates do not reach Meta fetching.

Browser checks use the existing labeled sample report and local intercepted authentication/API fixtures. They validate rendering and interaction, not a live Meta connection. Live account fetching, Meta permissions, remote exports, and the retained operational workspaces require authenticated integration validation. No full production build or full repository test suite is claimed.

Existing user changes to the original workspace overview, scope overlays, calendar controls, dependency files, and repository guidance are preserved.
