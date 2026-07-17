# Product lifecycle UX audit — Eric 2 NLM

Date: 2026-07-15

Environment: local production build, Chrome desktop at 1440 × 1000

Report scope: all five active campaigns, 2026-06-14 to 2026-07-14

Method: live browser walkthrough, network/runtime inspection, PDF inspection, heuristic evaluation, cognitive walkthrough, and automated contract verification

## Executive verdict

**UX health score: 62/100 — the authenticated performance workflow is operational, but client-facing output integrity is not yet trustworthy enough for unreviewed delivery.**

The main Meta workflow completed successfully:

1. Manual token validation and encrypted session creation.
2. Account selection for `Eric 2 NLM`.
3. Campaign scope loading with five active campaigns.
4. Report generation with live Meta data.
5. Chart, breakdown, and drilldown inspection.
6. Deterministic Verdict generation.
7. Insight fallback generation.
8. Client PDF export.

The strongest experience is the evidence hierarchy from account totals to diagnostics and recommendations. The most serious defect occurs at delivery: the dashboard and exported PDF disagree on account health, and the PDF introduces comparison deltas while the selected comparison mode is `No compare`.

## Safety and test boundaries

- The supplied Meta token was entered only in the local password field.
- The token was not written to this report, logs, screenshots, source files, or downloaded artifacts.
- No budget, campaign, ad set, ad, Page post, or other external account state was changed.
- No Facebook Page post was submitted.
- The local authenticated session was cleared after testing.
- The credential was pasted into chat and should be revoked or rotated after this audit.

## Live lifecycle results

| Lifecycle task | Result | Runtime evidence |
| --- | --- | --- |
| Open performance workspace | Pass | Correct Meta-gated entry and manual token fallback. |
| Validate supplied token | Pass | `POST /api/session` returned 200; no client console error. |
| Load accounts | Pass | Eight available accounts were presented. |
| Select Eric account | Pass | `Eric 2 NLM` selected; campaigns request returned 200. |
| Load scope | Pass | Five active campaigns; all active campaigns included by default. |
| Pull report | Pass | `GET /api/meta/report` returned 200 in approximately 4.97 seconds. |
| Review KPI overview | Pass | 282,875 impressions, 150,422 reach, 216 messages, ₫90,199 cost/message, 73.61% reply rate. |
| Review charts | Pass | Message trend, message cost, fatigue guardrail, and ad-set cost/message rendered. |
| Review breakdowns | Pass | Platform, age, gender, and geography switches all changed the active visualization and narrative. |
| Review tables | Pass | Campaign, ad set, ad, and daily tabs all selected correctly with appropriate columns. |
| Review running creatives | Pass with issues | Facebook preview rendered when visible; selected ad set showed `Campaign: Unknown campaign`. |
| Generate Verdict | Pass | Local deterministic Verdict returned in approximately 47 ms with high confidence and 20% budget guardrail. |
| Generate insight brief | Pass with fallback | Local fallback returned in approximately 13 ms; UI disclosed that live OpenRouter output was unavailable. |
| Export PDF | Mechanically pass, content integrity fail | 17-page A4 PDF, 161,597 bytes, selectable text. Dashboard/PDF health scores conflict. |
| Resume prior analysis after reload | Weak | Report, Verdict, insight, competitor, and TikTok state are not durable workspace records. |

## Live report snapshot

The report detected the `messages` KPI pack and returned:

- Spend: ₫19,482,877
- Impressions: 282,875
- Reach: 150,422
- Messages: 216
- Cost/message: ₫90,199
- Reply rate: 73.61%
- Dashboard health triage: 73/100, Grade C, Watch list
- Three warnings: campaign consolidation, efficiency decay, and funnel/landing-page drop
- Two recent-window root causes: messages down 23% with spend down 1%; conversion rate down 16% while CTR rose 76%

The deterministic Verdict identified the Bingo Care creative as the strongest message-cost performer and kept suggested budget movement within the 20% guardrail. The recommendation is cautious and evidence-linked.

## Anti-pattern verdict

**No manipulative dark patterns detected. Significant trust and lifecycle failures remain.**

There was no confirmshaming, forced consent, fabricated urgency, hidden cost, or deceptive subscription behavior. The relevant anti-patterns are operational:

- Contradictory status and output.
- A client-facing report that does not match the dashboard's health model.
- Comparison labels that do not match the user's selected scope.
- A workspace concept without durable workspace history.
- A competitor workflow that accepts manual evidence but can still block analysis when Apify is unavailable.

## Priority issues

### P0 — Dashboard and PDF publish different health scores

**Where:** Dashboard health triage versus exported PDF cover and executive summary.

**Observed:**

- Dashboard: `73/100`, Grade `C`, `Watch list`.
- PDF: `91/100`, Grade `A`.

**Cause:** The dashboard uses `summarizeHealth(report, diagnosis)`, which applies diagnostic penalties. The PDF uses raw `report.health.score` and `report.health.grade` through `buildClientReportViewModel()`.

**User impact:** A client can receive a materially more positive health grade than the operator reviewed. This breaks the product's core promise of defensible evidence and can change budget decisions.

**Route:** `/blueprint` for one canonical health contract, `/fortify` for output consistency checks, `/specify` for the shared score definition.

**Release gate:** Do not treat PDF export as client-ready until the dashboard card, Verdict context, PDF cover, executive summary, and API contract all use the same health score and grade.

### P0 — Manual competitor evidence can reach Ready but still cannot be analyzed

**Where:** Competitor evidence workspace and shared sticky action dock.

**Observed:** A correctly formatted manual note reaches `1 accepted` and `Accepted evidence — Ready`, but `Analyze evidence` remains disabled when the Apify capability is `needs_setup`.

**Cause:** `setupRequired` forces the dock status to `blocked`; `StickyActionDock` disables the primary action whenever status is blocked, overriding the valid manual-evidence `canAnalyze` state.

**User impact:** The user completes evidence preparation but cannot reach the promised competitor output.

**Route:** `/journey` and `/fortify`.

### P1 — `No compare` still produces ambiguous PDF deltas

**Where:** PDF KPI cards and comparison footnote.

**Observed:** The UI showed `No compare`, but the exported report displayed values such as `+17.1% vs prior period` and `-22.7% vs prior period`.

**Cause:** `buildKpiComparisons()` falls back to recent seven-day versus prior seven-day windows whenever no previous report exists, regardless of `compareMode === "off"`.

**User impact:** A client can reasonably interpret these as changes across the selected 30-day report period or against a deliberately selected prior report. The actual basis is not visible near the KPI.

**Route:** `/articulate`, `/measure`, and `/fortify`.

**Recommended rule:** When compare mode is off, either omit deltas or explicitly label them `Last 7 days vs previous 7 days` with exact dates.

### P1 — OAuth readiness does not reflect configuration

**Where:** Capability snapshot and Facebook Login action.

**Observed:** Facebook Login is available even though the current server lacks `META_APP_ID`; the route redirects back with a configuration error. Manual token authentication works.

**Cause:** Meta capability status only distinguishes authenticated versus unauthenticated. It does not expose OAuth configuration readiness.

**User impact:** A recommended authentication action is guaranteed to fail in the current environment.

**Route:** `/blueprint`, `/journey`, and `/articulate`.

### P1 — OAuth loses the intended destination

**Where:** Facebook OAuth start/callback flow.

**Observed from code contract:** The callback always redirects to `/`, while the authentication screen promises to return directly to Performance or Publishing.

**User impact:** A successful OAuth round trip breaks task continuity and makes users relocate the job they already chose.

**Route:** `/journey` and `/fortify`.

### P1 — Workspace work is mostly session-only

**Where:** Reports, Verdicts, insights, competitor evidence, and TikTok results.

**Observed:** These are component state and disappear on reload. Publishing drafts and language are partial local-storage exceptions.

**User impact:** The product calls itself a client workspace but cannot reliably resume, compare, revise, share, or audit prior decisions.

**Route:** `/strategize` first, then `/blueprint` and `/organize`.

### P2 — Running creative context is incomplete

**Where:** Running Ad Sets & Creatives.

**Observed:** The selected `Bài Genz` preview rendered correctly, but its context label said `Campaign: Unknown campaign`. Two `Reach` items also rely mainly on budget to distinguish them.

**User impact:** Analysts can inspect the creative but cannot confidently trace it back to the campaign hierarchy.

**Route:** `/blueprint` for campaign mapping and `/articulate` for disambiguated labels.

### P2 — Third-party preview pollutes the console

**Where:** Embedded Facebook ad preview iframe.

**Observed:** The preview rendered, but the embedded frame repeatedly logged a non-fatal Facebook router-state error.

**User impact:** It does not block the current user, but it makes production monitoring noisy and can hide real app errors.

**Route:** `/fortify` and `/measure`.

### P2 — Exported PDF is not tagged for accessibility

**Where:** Generated client PDF.

**Observed:** `pdfinfo` reported `Tagged: no`.

**User impact:** The report is selectable text but lacks a semantic reading structure for assistive technology.

**Route:** `/include` and `/specify`.

### P2 — Sticky action tooltip can state the opposite of the current state

**Where:** Shared `StickyActionDock`.

**Observed in TikTok:** A ready `Refresh profiles` action showed `Add at least one TikTok username` because `disabledReason` is used as the tooltip even when the action is enabled.

**Route:** `/fortify` and `/articulate`.

## Heuristic scores

Scale: 0 = no issue, 1 = cosmetic, 2 = minor, 3 = major, 4 = catastrophic.

| Heuristic | Score | Evidence |
| --- | ---: | --- |
| H1 Visibility of system status | 2 | Report, Verdict, fallback source, confidence, and workflow progress are visible; competitor/dock states can contradict readiness. |
| H2 Match with real-world language | 2 | Core reporting language is understandable, but `prompt`, `provenance`, `actor contract`, and provider jargon leak into the UI. |
| H3 User control and freedom | 1 | Scope editing, tab switching, collapsed diagnostics, and clear-session control work well. |
| H4 Consistency and standards | 4 | Dashboard/PDF health mismatch is a catastrophic client-facing consistency failure. |
| H5 Error prevention | 3 | OAuth is offered without required configuration; PDF can export before cross-output integrity is guaranteed. |
| H6 Recognition rather than recall | 1 | Scope, KPI definitions, report state, and evidence remain visible in context. |
| H7 Flexibility and efficiency | 1 | All-active defaults, KPI customization, multiple drilldowns, and keyboard-supported docks help expert use. |
| H8 Aesthetic and minimalist design | 1 | Strong information hierarchy; the long single-page report remains dense but generally scannable. |
| H9 Error diagnosis and recovery | 2 | Invalid-token and provider fallback messages are useful; configuration errors remain technical. |
| H10 Help and documentation | 2 | Strong inline explanations, but no durable audit trail or task history explains prior decisions. |

## Cognitive walkthrough

### Task: authenticate and pull an Eric report

1. Open Performance — Pass.
2. Choose manual token — Pass.
3. Validate token — Pass; server feedback and transition were clear.
4. Select `Eric 2 NLM` — Pass.
5. Confirm five active campaigns and date range — Pass.
6. Pull report — Pass; visible loading state and completion feedback.

Overall: **Pass**.

### Task: diagnose the account

1. Read KPI overview — Pass.
2. Interpret trend, efficiency, and fatigue charts — Pass.
3. Switch platform/age/gender/geography — Pass.
4. Inspect allocation risk — Pass.
5. Switch campaign/ad set/ad/daily tables — Pass.
6. Inspect running creative — Hesitation because campaign context is unknown.
7. Review health and root cause — Pass.

Overall: **Pass with hesitation**.

### Task: generate a decision

1. Generate Verdict — Pass.
2. See source and confidence — Pass, though `prompt` is internal terminology.
3. Review guarded recommendations — Pass.
4. Generate insight brief — Pass with explicit local fallback disclosure.

Overall: **Pass**.

### Task: deliver the report

1. Click Export PDF — Pass.
2. Receive a correctly named PDF — Pass.
3. Open and read the 17-page report — Pass.
4. Confirm report matches the reviewed dashboard — **Failure** because health score and comparison semantics differ.

Overall: **Failure at the trust handoff**.

## Positive findings to protect

- The overview and workflow sidebar make the current stage visible.
- Manual token authentication works and the token remains in an HttpOnly encrypted session.
- Report generation completed in under five seconds for five active campaigns.
- The dashboard cleanly separates trends, efficiency, fatigue, breakdowns, raw tables, health, root cause, and actions.
- Breakdown toggles and drilldown tabs worked without stale state.
- The ad preview rendered real creative and caption content when brought into view.
- Deterministic Verdict generation is fast, evidence-linked, and respects the 20% budget guardrail.
- Insight fallback is explicit about provider unavailability and confidence.
- PDF generation is fast, correctly named, A4, multi-page, and selectable text.
- The app itself produced no runtime console errors during the main flow; observed errors came from the embedded Facebook frame.
- Automated verification remains strong: 157 test files and 1,133 tests pass; production build succeeds.

## Recommended action sequence

### 1. `/blueprint` + `/fortify` — establish canonical output contracts

- Define one health score and grade shared by dashboard, Verdict, insight prompt, and PDF.
- Add a cross-output assertion before enabling export.
- Make comparison basis explicit in the data contract.
- Reject or omit ambiguous deltas when compare mode is off.

### 2. `/journey` + `/fortify` — remove lifecycle dead ends

- Allow accepted manual competitor evidence to proceed independently of Apify readiness.
- Separate collection capability from analysis capability.
- Preserve intended Performance or Publishing destination through OAuth.
- Hide or disable Facebook Login when OAuth is not configured.

### 3. `/strategize` + `/blueprint` — decide what a workspace owns

- Add saved client workspaces, report snapshots, prior Verdicts, evidence versions, and export history; or rename the product to communicate that it is a session tool.
- Make resuming yesterday's decision a first-class flow.

### 4. `/include` + `/articulate` — improve delivery clarity

- Tag PDF headings, lists, tables, and reading order.
- Replace internal provider terms such as `prompt` with user-facing source language.
- Label recent-window comparisons with exact dates.
- Replace `Unknown campaign` with resolved campaign context or an honest recovery message.

### 5. `/measure` + `/specify` — protect the lifecycle in CI

Add browser tests and product events for:

- Authentication success/failure by method.
- Account and campaign-scope selection.
- Report completion and latency.
- Dashboard/PDF score equality.
- Comparison-mode equality between UI and PDF.
- Verdict and fallback source.
- Export completion.
- Competitor manual-evidence activation.
- OAuth return destination.
- Resume-after-reload success.

## Release gates

1. Dashboard and PDF health score/grade are identical for the same report.
2. `No compare` cannot produce an unlabeled comparison in any client-facing output.
3. Accepted manual competitor evidence can always reach analysis without Apify.
4. OAuth availability reflects actual server configuration.
5. OAuth returns users to the workspace they selected.
6. A credentialed browser smoke covers report → Verdict → insights → PDF.
7. Exported PDF passes semantic accessibility checks or is explicitly labeled as not yet accessible.

## Verification record

- `POST /api/session`: 200
- `GET /api/meta/accounts`: 200
- `GET /api/meta/campaigns`: 200
- `GET /api/meta/report`: 200, approximately 4.97 seconds
- `POST /api/ai/verdict`: 200, approximately 47 ms
- `POST /api/ai/insights`: 200, approximately 13 ms
- PDF: 17 A4 pages, 161,597 bytes, selectable text, untagged
- Tests: 157 files passed, 1,133 tests passed
- Production build: passed
