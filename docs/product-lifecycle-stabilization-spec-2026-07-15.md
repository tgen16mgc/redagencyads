# Product lifecycle stabilization — engineering specification

## Ownership & context

- Owner: Red Agency Ads product and engineering
- Decision owner: Product owner
- Spec author: Codex, based on the 2026-07-15 live lifecycle audit
- Created: 2026-07-15
- Status: Ready for engineering for Slices 0–3; discovery required for durable workspaces and tagged PDF generation
- Version: v0.1
- Source audit: `docs/product-lifecycle-audit-2026-07-15-eric.md`

## Outcome

Make the current product safe to use from authentication through client delivery. A user must see one health judgment, one comparison basis, and one truthful action state everywhere the same report appears. The first release is a trust repair, not a dashboard redesign.

The release is successful when the live flow can complete without a contradiction:

`Connect → choose account → pull report → diagnose → generate decision → export`

For the same report, the dashboard, Verdict context, insight context, and PDF must use the same health score and grade. Selecting `No compare` must produce no comparison deltas. Accepted manual competitor evidence must remain analyzable even when automated collection is unavailable. Facebook Login must appear only when it can start and must return the user to the task they selected.

## Problem & user need

The authenticated reporting workflow works, but the delivery boundary is not trustworthy. In the audited Eric report, the dashboard displayed `73/100`, Grade `C`, while the exported PDF displayed `91/100`, Grade `A`. The PDF also added `vs prior period` deltas after the user selected `No compare`. These are not cosmetic inconsistencies: they can change client interpretation and budget decisions.

Two adjacent lifecycle paths also expose dead ends. Manual competitor evidence can be accepted but blocked from analysis by an unrelated Apify setup state. Facebook Login is offered when required server configuration is absent, and its callback discards the user's intended destination.

Users need the product to preserve the meaning of their choices through every output and to distinguish unavailable collection from unavailable analysis.

## Evidence baseline

- Live account flow completed for `Eric 2 NLM`, five active campaigns, 2026-06-14 through 2026-07-14.
- Report API completed in approximately 4.97 seconds.
- Dashboard health: `73/100`, Grade `C`, `Watch list`.
- PDF health: `91/100`, Grade `A`.
- UI scope: `No compare`; PDF still displayed comparison deltas.
- Manual competitor evidence reached accepted/ready but the primary analysis action remained disabled without Apify.
- Facebook Login was visible without `META_APP_ID`; the start route returned a configuration error.
- Existing automated baseline: 157 test files and 1,133 tests passed; production build passed.

## Design approach

- Preserve the current evidence hierarchy, report layout, scoring weights, budget guardrails, and manual-token security model.
- Fix shared contracts before polishing individual screens.
- Keep raw diagnostic inputs separate from client-facing presentation values.
- Treat status labels as descriptions of the action the user can take now, not as a summary of unrelated backend setup.
- Keep each slice independently releasable. Do not combine persistence or a broad navigation redesign with the trust repair.
- Use current components and visual tokens. No new design system primitives are required.

### What this change does not do

- It does not change the health-score penalty weights or grade thresholds.
- It does not alter campaign budgets, ads, Page posts, or any external Meta state.
- It does not add a database or durable workspace history.
- It does not redesign charts, report information architecture, or AI provider selection.
- It does not promise tagged PDFs until a compatible generation approach is selected.
- It does not retain or log access tokens beyond the existing encrypted HttpOnly session.

## Release sequence

| Slice | Priority | Outcome | Can ship independently? |
| --- | --- | --- | --- |
| 0. Conditional containment | P0 | Prevent known-inconsistent PDF delivery if Slice 1 cannot ship immediately | Yes; remove when Slice 1 passes |
| 1. Output integrity | P0/P1 | One health contract and comparison contract across dashboard, AI context, and PDF | Yes; first required release |
| 2. Workflow continuity | P0/P1 | Manual evidence analysis works without Apify; OAuth availability and return path are truthful | Yes, after Slice 1 |
| 3. Context and copy integrity | P2 | Campaign attribution, action tooltips, provider labels, and third-party error classification are clear | Yes, after Slice 2 |
| 4. Product discovery | Strategic/P2 | Decide durable workspace ownership and accessible PDF architecture | No implementation commitment in this spec |

## Slice 0 — conditional export containment

Use this slice only if the output-integrity fix cannot be deployed in the same release. Do not add a long-lived feature flag.

### Intent

Prevent an operator from sending a report known to contradict the reviewed dashboard.

### Behavior

- Disable both `Export PDF` entry points: the header button and the Performance action dock item.
- Keep the dashboard, Verdict, insight brief, and copy-prompt actions available.
- The disabled reason must explain that report export is temporarily unavailable while output checks are being updated.
- Remove this containment as part of Slice 1 after all output-integrity release gates pass.

### Exact copy

| Element | English | Vietnamese |
| --- | --- | --- |
| Disabled tooltip | Export is temporarily unavailable while report consistency checks are updated. | Tạm thời chưa thể xuất báo cáo trong lúc cập nhật kiểm tra tính nhất quán. |
| Optional inline notice | Review the dashboard here; PDF delivery will return after consistency checks pass. | Hãy xem báo cáo trên dashboard; chức năng xuất PDF sẽ trở lại sau khi vượt qua kiểm tra nhất quán. |

### Acceptance criteria

- Neither export entry point creates a file.
- Keyboard and pointer users receive the same disabled reason.
- No other report action is disabled.

## Slice 1 — output integrity

### Contract 1: canonical client-facing health

#### Intent

One report must have one client-facing health judgment. The current dashboard calculation is the accepted source of truth for this stabilization release.

#### Contract

- `report.health` remains the raw diagnostic baseline and check list.
- A single pure health-summary function owns presentation values. It combines the raw health checks with `diagnoseDailyChange()` and returns the existing `HealthScoreSummary` shape.
- The current formula remains unchanged:
  - danger item penalty: 12 points;
  - warning item penalty: 6 points;
  - final score clamped to 0–100;
  - grade thresholds remain A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 45, otherwise F.
- No client-facing surface may display `report.health.score` or `report.health.grade` directly.
- Required consumers of the canonical summary:
  - dashboard Health Triage card;
  - health KPI card when selected;
  - generated analyst prompt;
  - structured Verdict enhancement context;
  - insight prompt and local insight fallback;
  - PDF cover, executive summary, and health KPI;
  - default/fallback Verdict copy.
- Internal diagnostics such as experiment readiness may continue to use raw checks where their rules explicitly require raw input, but they must not present the raw grade as the account's final health grade.

#### Failure behavior

- If a report does not contain enough daily data, `diagnoseDailyChange()` returns no daily causes and the canonical summary uses the raw checks only. This is not an export blocker.
- If a consumer cannot obtain the canonical summary, it must fail closed: omit the health grade or block export with a user-facing consistency error. It must never fall back silently to the raw score.

#### Export preflight

Before generating the PDF, build the canonical health summary once and pass that same object into the client report view model. Export is allowed only if the PDF model's score and grade equal the dashboard presentation values for the active report.

The preflight is a deterministic assertion, not a network call. On failure:

- do not download a file;
- keep the current dashboard visible;
- show `Report export stopped because the health summary did not match the dashboard. Refresh the report and try again.`;
- log only report metadata needed for diagnosis, never the token or full prompt.

### Contract 2: comparison provenance

#### Intent

The PDF must preserve the user's selected comparison choice. A trend window is not a substitute for a requested report comparison.

#### State rules

| UI selection | Previous report available | KPI deltas | Client-facing explanation |
| --- | --- | --- | --- |
| `No compare` | Either | None | `No comparison selected for this report.` |
| WoW/MoM/YoY | Yes | Show selected-range deltas | Include mode and exact current/previous date ranges |
| WoW/MoM/YoY | No | None | `Comparison unavailable; this report contains current-period values only.` |

Additional rules:

- `buildKpiComparisons()` returns an empty array immediately when `compareMode === "off"`.
- Recent seven-day versus prior seven-day movement remains available to root-cause diagnostics, but it is not rendered as a report comparison.
- Changing compare mode to `off` clears stale previous-report state before the next export.
- A comparison fetch failure must not reuse an older comparison report.
- Compact KPI labels may use `vs WoW`, `vs MoM`, or `vs YoY`; the PDF section footnote must state both exact date ranges.
- The comparison footnote is generated from the active state, not static copy.

### Performance workspace states

#### Default

- Report values and health summary render as today.
- Export is enabled only when report data exists and the deterministic preflight can be built.

#### Exporting

- Both export entry points show the existing spinner and are disabled against duplicate activation.
- The rest of the dashboard remains readable.

#### Consistency error

- No file is downloaded.
- A destructive alert appears in the existing error surface.
- Focus moves to or is announced by the alert; the user's report and scope remain intact.

#### Comparison unavailable

- Current-period report remains usable.
- No delta arrows or percentages render.
- The PDF states that comparison was unavailable rather than implying no change.

### Slice 1 file ownership

| Area | Current file | Required responsibility |
| --- | --- | --- |
| Canonical health | `lib/health-score.ts` | Expose the one report-to-summary path; retain current weights and thresholds |
| Daily causes | `lib/daily-diagnosis.ts` | Remain the only recent-window diagnostic source |
| Report assembly/prompt | `lib/meta.ts`, `lib/metrics.ts` | Supply canonical health to analyst and insight contexts |
| Verdict enhancement | `lib/ai/verdict.ts` | Use canonical health context, not raw presentation values |
| Local insights | `lib/ai/insights.ts` | Read the canonical health payload |
| Dashboard | `components/dashboard-shell.tsx` | Derive once per active report and share with health card/export |
| PDF model | `lib/client-report.ts` | Accept canonical health; enforce comparison rules and dynamic footnote |
| PDF layout | `lib/client-report-pdf.ts` | Render only values supplied by the view model |
| Shared types | `lib/types.ts` | Change only if the canonical summary crosses a public boundary |

### Slice 1 test matrix

| Test | Fixture | Expected result |
| --- | --- | --- |
| Health parity regression | Raw 91/A with diagnostic penalties producing 73/C | Dashboard summary, PDF cover, PDF KPI, default Verdict, and prompt context all use 73/C |
| Healthy report | Raw 90/A, pass checks, no daily causes | All outputs use 90/A |
| Insufficient daily history | Fewer than six dated rows | No daily penalty; raw checks still summarized consistently |
| Compare off with previous report present | `compareMode: off` plus stale previous fixture | No deltas and no `vs prior period` copy |
| Compare off with daily history | 14 dated rows | No client-facing deltas; diagnostics may still use recent windows |
| Compare on | Valid previous report | Deltas render with selected mode and exact ranges |
| Compare unavailable | Non-off mode, no previous report | No deltas; explicit unavailable explanation |
| Export preflight mismatch | Deliberately inconsistent model fixture | No PDF download; consistency error returned |
| EN/VI parity | Same report in both languages | Numeric health and comparison basis identical; copy localized |

## Slice 2 — workflow continuity

### Competitor evidence: collection and analysis are independent capabilities

#### Intent

A user who supplies accepted advertiser-linked evidence must be able to analyze it. Apify controls automated collection only.

#### Readiness model

- `collectionReady`: competitor names exist, Apify is configured, and no collection/analysis request is running.
- `analysisReady`: competitor names exist, at least one accepted manual or collected evidence item exists, and no collection/analysis request is running.
- `setupRequired` affects `collectionReady`; it does not override `analysisReady`.
- When `analysisReady` is true, the primary action is `Analyze evidence`, the dock status is `ready`, and `Cmd/Ctrl + Enter` runs analysis.
- When manual evidence is accepted and Apify is missing, `Refresh evidence` remains disabled with an Apify-specific reason while `Analyze evidence` remains enabled.
- Rejected and needs-review evidence do not count toward analysis readiness.
- Removing the last accepted item returns the action to blocked and explains the evidence requirement.

#### Competitor states and copy

| State | Status | Primary action | Supporting copy |
| --- | --- | --- | --- |
| No competitor names | Blocked | Collect evidence, disabled | Add at least one competitor. |
| Names, no Apify, no accepted manual evidence | Blocked for collection | Collect evidence, disabled | Automated collection needs Apify. You can add advertiser-linked manual evidence instead. |
| Accepted manual evidence, no Apify | Ready | Analyze evidence, enabled | Manual evidence is ready to analyze. Automated collection is unavailable. |
| Collected items need review | Blocked | Analyze evidence, disabled | Review and accept at least one credible evidence item. |
| Accepted evidence | Ready | Analyze evidence, enabled | `{count} accepted — ready to analyze` |
| Request running | Working | Current action, disabled | Existing collection/analysis progress copy |

#### Accessibility

- Status text and button enabled state must agree.
- The disabled reason belongs only to the disabled action.
- The keyboard shortcut must use the same readiness check as pointer activation.
- Status changes are announced through the existing polite live region.

### Facebook OAuth readiness

#### Intent

Do not offer an authentication method that is guaranteed to fail in the current deployment.

#### Capability contract

- `/api/capabilities` exposes whether Facebook OAuth is configured.
- OAuth is configured only when both `META_APP_ID` and `META_APP_SECRET` are present. The redirect URI remains optional because the existing request-derived default is supported.
- While capability status is unknown, do not briefly render an enabled Facebook Login button.
- When OAuth is unavailable, manual token authentication becomes the first actionable method and the UI shows a non-technical deployment note.
- Never expose environment-variable names to end users.

#### Return-destination contract

- The Facebook Login start request includes the allowlisted intended view: `ads` or `publisher`.
- The server stores that destination with the short-lived OAuth transaction and deletes it after callback handling.
- Success returns to `/?view=ads` or `/?view=publisher`.
- Denial, state mismatch, token validation failure, and configuration failure return to the same intended view with `auth_error`.
- Missing or invalid destinations fall back to `/`.
- External URLs, arbitrary paths, and script-like values are never accepted as return destinations.

#### OAuth states and copy

| State | Facebook Login UI | Supporting copy |
| --- | --- | --- |
| Checking | Hidden or disabled without layout shift | Checking Facebook Login availability… |
| Available | Enabled primary button | Continue with Facebook Login. |
| Not configured | Button hidden | Facebook Login is not available on this deployment. Use a Meta access token below. |
| Callback error | User returns to intended screen | Facebook Login could not finish. Try again or use a Meta access token. |

Vietnamese equivalents:

- `Đang kiểm tra Facebook Login…`
- `Tiếp tục bằng Facebook Login.`
- `Facebook Login chưa khả dụng trên bản triển khai này. Hãy dùng Meta access token bên dưới.`
- `Không thể hoàn tất Facebook Login. Hãy thử lại hoặc dùng Meta access token.`

### Slice 2 file ownership

| Area | Current file | Required responsibility |
| --- | --- | --- |
| Competitor readiness | `components/dashboard-shell.tsx` | Give analysis readiness precedence over collection setup |
| Shared action dock | `components/dashboard/sticky-action-dock.tsx` | Describe only the active state; show disabled reasons only when disabled |
| Capabilities | `lib/capabilities.ts`, `app/api/capabilities/route.ts` | Report OAuth configuration without leaking secrets |
| Auth screen | `components/dashboard-shell.tsx` | Render an available method and preserve intended view |
| OAuth start | `app/api/auth/facebook/start/route.ts` | Validate and store allowlisted return destination |
| OAuth callback | `app/api/auth/facebook/callback/route.ts` | Restore and clear return destination on success/failure |
| OAuth helpers | `lib/meta-oauth.ts` | Own constants and safe destination validation if shared |

### Slice 2 test matrix

| Test | Expected result |
| --- | --- |
| Accepted manual evidence + no Apify | Analyze enabled; status ready; collect/refresh disabled |
| Needs-review only + no Apify | Analyze disabled with evidence reason |
| Accepted collected evidence + Apify | Analyze enabled |
| Ready action tooltip | Shows action label or explicit tooltip, never a stale disabled reason |
| OAuth credentials complete | Capability reports available; Login renders |
| App ID or secret missing | Capability reports unavailable; Login is not actionable |
| Start from Performance | Success and error return to `/?view=ads` |
| Start from Publishing | Success and error return to `/?view=publisher` |
| Malicious return destination | Callback returns to `/` |
| OAuth state mismatch | Transaction cookies are cleared; safe error returned |

## Slice 3 — context and copy integrity

### Running creative campaign attribution

- Resolve campaign names from the selected campaign collection by `campaign_id`; do not rely solely on `campaign_name` in the ad-set payload.
- If an ID cannot be resolved, show `Campaign unavailable` plus a short non-secret identifier instead of `Unknown campaign`.
- When two entries share the same name, show campaign name and ad-set name together before budget so the hierarchy, not budget alone, distinguishes them.
- Unit coverage belongs in `lib/__tests__/adset-preview.test.ts`.

### Action dock tooltip truth

- `disabledReason` is displayed only while an action is disabled.
- Enabled actions use `tooltip` when supplied, otherwise the action label.
- The native `title` attribute follows the same rule.
- Verify Performance, competitor, TikTok, and Publisher dock instances.

### Provider labels

- Map internal provider value `prompt` to `Local rules only` / `Luật local` everywhere it is shown.
- Do not display raw provider enum values in insight or Verdict badges.

### Third-party preview error classification

- In browser smoke evidence, classify console errors originating inside the embedded Facebook iframe separately from first-party dashboard errors.
- Do not suppress first-party dashboard errors.
- A preview that fails to load must show the existing no-preview recovery state; a third-party console error alone must not mark a rendered preview as failed.
- No monitoring vendor or new telemetry dependency is required for this slice.

### PDF accessibility disclosure

- Until tagged output is supported, do not claim the PDF is accessible.
- Keep selectable text and logical visual order as current minimum quality.
- The decision between tagged PDF generation and an accessible HTML report is part of Slice 4 discovery.

## Use cases & edge cases

### Use case 1: operator exports a no-compare report

1. Operator selects `No compare` and pulls the report.
2. Dashboard renders current-period KPIs and the canonical health summary.
3. Root-cause diagnostics may discuss recent daily movement inside their own labeled section.
4. Export preflight confirms dashboard and PDF health parity.
5. PDF contains no delta arrows, percentages, `vs prior period`, or implied comparison footnote.
6. PDF states `No comparison selected for this report.`

### Use case 2: operator exports a MoM report

1. Operator selects MoM and pulls current and prior reports.
2. Dashboard and PDF show deltas only after both reports succeed.
3. Compact deltas use `vs MoM`; the PDF footnote includes exact current and prior ranges.
4. If the prior request fails, current data remains available, deltas disappear, and the report states comparison is unavailable.

### Use case 3: manual competitor analysis without Apify

1. User enters competitor names and advertiser-linked manual evidence.
2. Evidence review marks one item accepted.
3. UI shows automated collection as unavailable but analysis as ready.
4. User runs analysis by button or keyboard shortcut.
5. Only accepted evidence enters the generated competitor prompt.

### Use case 4: Facebook Login unavailable

1. User opens Performance or Publishing while unauthenticated.
2. Capability response reports OAuth not configured.
3. The screen does not offer a failing Facebook Login action.
4. Manual token entry is immediately available with existing security guidance.

### Use case 5: OAuth denied from Publishing

1. User starts Facebook Login from Publishing.
2. Facebook returns denial.
3. Callback clears OAuth transaction state and returns to `/?view=publisher&auth_error=…`.
4. Publishing authentication screen shows a user-safe error and retains the correct task context.

### Edge cases

- Health score at grade boundaries: 90, 75, 60, 45, 0, and 100.
- Duplicate health items must not be counted twice if the same report is rendered repeatedly.
- Report changes after a Verdict was generated: stale Verdict and insight output should be cleared by the existing report-refresh flow before export.
- Compare mode changed after pulling a report: stale previous-report data cannot leak into PDF.
- Zero previous-period value: delta may say `new` only when a valid comparison report exists.
- Long account/campaign/ad-set names: truncate visually while preserving full accessible name or tooltip.
- Capability endpoint failure: keep manual token available; do not assume OAuth is available.
- OAuth callback opened without transaction cookies: safe error, safe `/` fallback, no redirect loop.
- Accepted evidence removed during analysis: the in-flight request completes against its submitted snapshot; the next action recomputes readiness.
- PDF export activated twice: one file maximum while `exportingPdf` is true.

## Copy matrix

| Element | English | Vietnamese |
| --- | --- | --- |
| No comparison footnote | No comparison selected for this report. | Báo cáo này không chọn kỳ so sánh. |
| Comparison unavailable | Comparison unavailable; this report contains current-period values only. | Không có dữ liệu kỳ so sánh; báo cáo chỉ hiển thị kỳ hiện tại. |
| Export consistency error | Report export stopped because the health summary did not match the dashboard. Refresh the report and try again. | Đã dừng xuất báo cáo vì tóm tắt sức khỏe không khớp dashboard. Hãy tải lại báo cáo và thử lại. |
| Manual evidence ready | Manual evidence is ready to analyze. Automated collection is unavailable. | Evidence thủ công đã sẵn sàng để phân tích. Thu thập tự động hiện chưa khả dụng. |
| Evidence requirement | Accept at least one evidence item with credible advertiser provenance. | Chấp nhận ít nhất một evidence có advertiser và provenance đáng tin. |
| OAuth unavailable | Facebook Login is not available on this deployment. Use a Meta access token below. | Facebook Login chưa khả dụng trên bản triển khai này. Hãy dùng Meta access token bên dưới. |
| OAuth generic failure | Facebook Login could not finish. Try again or use a Meta access token. | Không thể hoàn tất Facebook Login. Hãy thử lại hoặc dùng Meta access token. |
| Unresolved campaign | Campaign unavailable | Không xác định được campaign |
| Local provider | Local rules only | Luật local |

## Accessibility requirements

- Enabled state, visual status, tooltip, `aria-label`, and keyboard behavior must agree.
- Errors that stop export or authentication must be announced through an alert/live region and remain visible until the user changes state or retries.
- Disabled controls need a discoverable reason for keyboard and pointer users; do not rely on color.
- The OAuth method change must not move focus unexpectedly when capabilities resolve.
- Exact comparison ranges must be readable text, not encoded only in arrow direction or color.
- PDF text must remain selectable. Tagged reading order remains an explicit unresolved requirement, not a silent claim.

## Measurement & instrumentation

This stabilization spec uses engineering reliability measures derived from the audit. It does not define new business KPIs.

### Primary release measure

- Cross-output integrity pass rate: 100% of tested report fixtures produce identical health score/grade and comparison basis across dashboard model, AI context, and PDF model.

### Counter-metrics

- Report pull latency must not regress because the canonical health computation is local and deterministic.
- Export generation must remain a client-side operation and must not transmit the token.
- Manual token authentication success and existing 20% budget guardrail behavior must not regress.
- No first-party console errors in the credentialed lifecycle smoke.

### Events to add when the project has an approved analytics sink

Do not add a new analytics vendor in this change. Define event names now so later instrumentation is consistent:

- `report_pull_completed` with duration, compare mode, campaign count, and result status;
- `report_export_preflight_failed` with mismatch category only;
- `report_export_completed` with compare mode and page count, no report content;
- `competitor_analysis_started` with evidence source counts;
- `oauth_method_presented` with configured state;
- `oauth_callback_completed` with destination and success/failure category.

Never include access tokens, prompts, advertiser text, ad copy, or account IDs in these events.

## Verification plan

### Automated checks

Run targeted tests during each slice, then the complete suite and build:

1. `npm test -- --run lib/__tests__/health-score.test.ts lib/__tests__/metric-comparison.test.ts lib/__tests__/client-report.test.ts lib/__tests__/client-report-pdf.test.ts`
2. Slice 2 targeted tests covering capabilities, OAuth routes, dashboard access, competitor evidence, and action-dock readiness.
3. Slice 3 targeted tests covering ad-set preview mapping and tooltip state.
4. `npm test -- --run`
5. `npm run build`

### Credential-free contract smoke

Use fixture reports to verify:

- 73/C parity across the dashboard view model and generated PDF model;
- no comparison strings when compare mode is off;
- exact range labels when compare mode is on;
- export preflight blocks a deliberately inconsistent fixture.

### Credentialed browser smoke

Use a fresh test token supplied through the UI or local environment only; never commit it. No external state changes are allowed.

1. Authenticate and select the intended test account.
2. Pull all active campaigns for a known date range.
3. Confirm dashboard health.
4. Generate Verdict and insight brief.
5. Export PDF and inspect its score, grade, deltas, date ranges, filename, page count, and selectable text.
6. Test manual competitor evidence with Apify unavailable.
7. Test OAuth visibility in configured and unconfigured environments; use mocked callback routes unless a dedicated OAuth test app is available.
8. Clear the local token session.

## Release gates

Slice 1 cannot ship until all of these are true:

1. Dashboard and PDF score/grade are identical for every contract fixture.
2. Analyst/Verdict/insight contexts use the same canonical health summary.
3. `No compare` produces zero KPI deltas and an explicit no-comparison footnote.
4. Selected comparisons include correct exact ranges; stale previous reports cannot leak.
5. Export preflight blocks a forced mismatch without downloading a file.
6. Targeted tests, full tests, and production build pass.

Slice 2 cannot ship until all of these are true:

1. Accepted manual competitor evidence reaches analysis without Apify.
2. Collection setup never disables an otherwise-ready analysis action.
3. Facebook Login appears only with complete OAuth configuration.
4. OAuth success and failure return to the allowlisted intended view.
5. Technical environment-variable names are absent from user-facing auth errors.

Slice 3 cannot ship until all of these are true:

1. Resolvable running ad sets show their campaign name.
2. Enabled dock actions never show disabled-state tooltip copy.
3. Provider badges use localized user-facing labels.
4. The browser smoke record distinguishes first-party errors from Facebook iframe noise, with zero first-party errors.

## Pending questions

These questions do not block Slices 0–3.

### Product decisions for Slice 4

- Is this product a durable client workspace or an intentionally session-based analysis tool? The answer determines whether to add report snapshots, Verdict history, evidence versions, and export history or rename the product promise.
- Should accessible delivery use a tagged PDF generator or an accessible hosted HTML report with optional PDF print output?
- What retention and deletion policy applies if report snapshots are stored?

### Engineering investigation for Slice 4

- Which persistence boundary can store report artifacts without storing Meta access tokens?
- Can the current jsPDF path produce reliable semantic tags, or should delivery move to an HTML/document pipeline?
- What first-party error-monitoring sink and iframe-origin filter should be used? No vendor is selected by this spec.

## Ethical review

- Patterns reviewed: false status, hidden failure, coercive authentication, misleading comparison, fabricated confidence, and accidental disclosure.
- The change removes misleading output and guaranteed-fail actions; it does not add urgency, forced consent, or hidden data collection.
- Manual-token fallback remains explicit and does not pretend to be the preferred hosted authentication method when OAuth is available.
- Comparison and health provenance are made visible so users can challenge the evidence behind a recommendation.
- Dark pattern clearance: no deceptive, coercive, or manipulative behavior is specified.

## Assets & deliverables

- Lifecycle audit: `docs/product-lifecycle-audit-2026-07-15-eric.md`
- Engineering specification: this document
- Existing UI components and design tokens: reuse in place; no new visual assets
- Required test artifacts: fixture report for the 91/A raw to 73/C canonical regression, compare-off/on fixtures, OAuth return-path fixtures, and accepted-manual-evidence fixture

## Handoff checklist

- [x] Every changed state has an intent and user need.
- [x] Exact EN/VI copy is supplied for new user-facing states.
- [x] Loading, error, unavailable, ready, and stale-data cases are covered.
- [x] Accessibility behavior is specified with the interaction state.
- [x] Ownership and affected files are mapped.
- [x] Test criteria and release gates are explicit.
- [x] Ethical review is complete.
- [x] Strategic questions are separated from implementation-ready work.
- [x] No access token, account ID, or sensitive report payload is included.
