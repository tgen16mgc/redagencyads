# Plan to close the Funnel tab's unmet needs

Date: 17 October 2026. Planning only; no feature implementation or live integration performed.

Prepared from an independent GPT-6 Astra review using fresh context and high reasoning, followed by a parent review of the key repository references. The review used source inspection, not live account or vendor verification. Existing dirty redesign files were preserved.

## Recommendation

Ship a small release that saves a reproducible investigation. In parallel with product discovery, validate one representative business-outcome export before committing to a connector. Then deliver one outcome pilot: qualified leads, qualified conversations/appointments, or paid orders according to the account's actual goal.

Keep three distinct questions in the product:

1. **Meta event efficiency:** what changed in delivery, event ratios and cost?
2. **Business outcomes:** which recorded leads/conversations/orders became useful results?
3. **Linked journeys:** which observed people completed an ordered sequence, and how long did it take?

Each requires different data and denominators. Adding columns to the current Meta aggregate funnel cannot resolve all three.

## Corrections to the earlier gap assessment

| Existing capability | Actual gap |
| --- | --- |
| Report snapshots retain report, comparison and execution scope (`lib/report-history.ts:5`; `app/api/workspace/reports/route.ts:56`) | Named investigations do not retain the full selected-stage view or immutable evidence revisions. History currently returns the latest 12 and upserts by scope, so it cannot serve unchanged as an investigation archive. |
| Meta contains purchase/ROAS fields; GA4 requests channel-group `keyEvents` and `totalRevenue` (`lib/ga4-attribution.ts:91`) | CRM qualification and reconciled paid/refunded business outcomes are missing. GA4 totalRevenue is not a verified purchase-only ledger, collected cash or profit. |
| Budget alerts, action audit and execution surfaces exist | They do not provide a scoped funnel investigation with owner, due date and contextual watches. Reuse useful patterns, not the existing global JSON storage for private investigations. |
| Aggregate rows have daily dates | They do not contain person-linked events. Lead creation and qualification timestamps can enable time-to-qualification without a complete click-to-sale journey. |

These findings describe this checkout. They do not establish what the business already has in an external CRM, commerce system or analytics account.

## Release 1: Save the exact investigation

**User journey:** select a step → locate a source → save a named investigation → reopen it after reload or another session → see the original question and evidence.

**Add** Save investigation, a compact saved list, title, optional personal note, evidence age, and explicit Refresh data. Persist:

- The resolved stage key, breakdown level, search, sort, trend and target from `FunnelViewState` (`components/dashboard/performance-funnel.tsx:29`). Save an automatically suggested stage as its explicit key.
- Custom stage keys, account/campaign selection, primary KPI pack, fixed current/comparison dates and resolved execution scope.
- Report/comparison payloads, source pull timestamps, view schema version and immutable evidence revision ID.

Reopen the saved revision by default. Refresh creates a new revision; it must not silently rewrite the old diagnosis. Two investigations with identical report dates must coexist.

**Implementation:** reuse report snapshot types, workspace authentication and restoration patterns. Add purpose-specific investigation/revision records rather than extending the scope-upserted recent-history list (`app/api/workspace/reports/route.ts:112`). Add a versioned view-state serializer and restoration handling to PerformanceV2. Keep existing export behavior; call an export an investigation export only when its saved context is included.

**Default:** private to the creator. Defer sharing, assignments, watches and external sends from this slice.

**Acceptance:** reload restores the exact scope, stage, comparison, filter and target; refresh preserves old evidence; missing entities and incompatible saved versions show clear recovery states. Test workspace/account isolation and server-authorized account binding. A stale snapshot remains visibly historical.

## Release 2: One reliable business-outcome pilot

**Source decision:** choose an account and a stable authoritative export. A bounded CSV import with preview and reconciliation is the recommended first integration. Build a vendor connector after the mapping and metrics prove useful.

| Account goal | First useful outcome | Required link |
| --- | --- | --- |
| Lead generation | Qualified, pending and disqualified leads; cost per matched qualified lead | Stable source lead ID, creation/status timestamps, captured ad attribution where available |
| Messages | Qualified conversations or booked appointments | Stable conversation/appointment records and explicit attribution; Meta replies alone are insufficient |
| Sales | Paid orders, refunds and net collected amount | Stable orders and payment/refund transactions, currency and attribution |
| Traffic / awareness | Continue click/delivery analysis | CRM is optional; do not add a compulsory qualification step |

A lead-generation pilot is a planning default, not a claim about the user's actual first account. Prefer whichever source has reliable IDs and a useful business definition.

**User journey:** open the relevant step → open Business outcomes → import and reconcile → inspect outcomes, coverage and developing cohorts → compare the supported source level → save the finding.

**UI:** add a distinct Business outcomes panel below Meta analysis. Retain Meta lead events and CRM lead records as separate measures. Replace “quality unavailable” only for scopes supported by a validated source. Show source, definition, last update, matched/ambiguous/unmatched counts and attribution level. Do not distribute campaign-only attribution down to ads.

For qualification:

- Qualification rate = unique qualifying source records / unique eligible source records from the **same acquisition cohort**.
- Show pending and unknown outcomes. Never divide CRM-qualified people by Meta aggregate lead events and call it person-level conversion.
- Cost per qualified lead = aligned scope spend / matched qualified records, explicitly labeled. Incomplete coverage must be visible beside rankings.
- Use a configurable follow-up window. Seven days is a provisional pilot setting to validate, not an established business fact. Compare cohorts old enough to complete it; recent cohorts remain developing.
- Time-to-qualification requires recorded creation and qualification-effective timestamps. Start with median duration among qualified records plus the qualified/eligible count and window; do not imply it measures the time for all leads. Reject impossible timestamp orderings.
- Without historical status timestamps, show a current-status snapshot and withhold historical qualification rates and durations.

**Acceptance:** reconcile an approved source sample; demonstrate idempotent reimport, duplicate handling, revised qualification, unmatched attribution, partial follow-up and tracked zero outcomes. Explain exclusions. Withhold quality-based budget recommendations until source coverage, scope and freshness are credible.

## Release 3: Share evidence and track follow-up

**User journey:** open saved evidence → share with authorized workspace members → attach a follow-up with owner, due date and status → revisit the referenced evidence when resolving it.

Add workspace-only sharing, chronological notes and a compact follow-up section. Link to existing action-plan and experiment surfaces; avoid introducing another general task board. A follow-up does not execute an ad change.

Then add an opt-in **in-app watch**: explicit metric and denominator, entity scope, baseline/rule, event-count caution, evaluation cadence and source freshness. Suppress evaluation when inputs are missing/stale. Deduplicate repeated notifications. A threshold breach is an observation, not proof of significance or cause.

Existing budget alert delivery patterns can be reused later. Its daily evaluation aggregates configured performance rows and has no funnel investigation context (`app/api/cron/budget-alerts/daily/route.ts:31`); do not reuse that aggregation unchanged. Existing `ActionAuditEntry` has no first-class workspace/account fields and defaults to JSON storage (`lib/action-audit.ts:5`, `lib/action-audit.ts:32`). Reuse action concepts, not this store for private outcomes or shared investigations.

**Acceptance:** recipients open exactly the referenced evidence revision; unauthorized/revoked users cannot; assignment history survives changes; repeated evaluations do not duplicate alerts; no note/watch causes budget execution. External delivery requires a chosen destination and explicit opt-in.

## Later branches: revenue reconciliation and linked journeys

For a sales-first account, move revenue reconciliation into Release 2. Require a paid-order/payment source and refunds/cancellations before claiming realized or net revenue. Display gross collected amount, refunds and net collected amount separately. Disclose currency and tax/shipping basis. Meta, GA4 and business-system revenue are separate lenses; do not sum them.

Build a separate cohort view when first-party identity and event instrumentation exist. The user selects an entry event, ordered steps, identity basis and completion window. Show observed completion, incomplete follow-up and time-to-convert; retain attribution and identity caveats. Do not carry the current fixed-denominator scenario into this mode without a defensible separate model.

Defer a full identity graph, cross-device stitching, multi-touch attribution, causal uplift and automatic optimization. They have independent data and validation requirements.

## Minimum data and matching contract

Use separate typed records rather than making `NormalizedRow` represent every kind of data.

| Model | Minimum fields |
| --- | --- |
| Meta aggregates | Workspace/account binding, entity IDs, dates/timezone, counts, spend/currency, tracking availability, pull time and known reporting/attribution settings. Preserve canonical denominators in `lib/funnel-analysis.ts:8`. |
| Business outcomes | Source connection, stable external record ID, acquisition/creation time, current status, status-effective time, source-updated time, ingestion time, revision and explicit deletion/retraction marker. Qualification needs a versioned definition. |
| Linked events | Stable event ID, pseudonymous subject/session ID, event type, event time, ingestion time, source linkage and mapping/identity version. Store the cohort and completion-window definition with results. |
| Payments/refunds | Order ID, independently deduplicated payment/refund transaction IDs, signed amounts, currency, paid/refunded timestamps, order linkage and tax/shipping treatment. |

Prefer exact platform lead IDs or source-captured account/campaign/ad-set/ad IDs. A click ID is useful only where an actual mapping exists; aggregate Meta reports do not expose a click-to-person lookup. Never join by names. Ambiguous records remain unmatched. Record match method and attribution granularity. Default to the source-captured acquisition assignment and label it; do not infer incremental contribution.

Deduplicate by workspace + source connection + external ID, with event/version keys for status and transaction changes. Newer source versions supersede older live state; identical imports are no-ops. Absence from a partial export is not deletion. Explicit tombstones/retractions adjust current calculations and retain a scoped audit trail. Mark saved evidence as historical when later corrections change the live result; if source removal requires redaction, surface that revision state rather than silently changing the evidence.

Do not reuse the pipeline's successful-job shortcut unchanged: it keys by platform/mode/window and can skip corrections to an already imported period (`lib/data-pipeline.ts:131`). Use revision-aware ingestion, bounded reconciliation and backfill.

Store UTC timestamps plus source timezone, and apply account-timezone date boundaries consistently. Separate acquisition cohorts from outcomes occurring during a calendar period. Late outcomes update a live revision; frozen investigations remain tied to their revision. Preserve stale last-known values with age warnings; unknown is not zero.

Refunds outside the acquisition period still adjust the appropriate order cohort. Do not mix currencies without a documented FX basis. Do not infer an order ledger from Meta ROAS or GA4 totalRevenue. `getInsights` does not itself explicitly set attribution windows (`lib/meta.ts:268`); unknown settings remain unknown instead of receiving an assumed historical window. Preserve GA4 and Meta attribution separately.

## Architecture and verification gates

Reuse Supabase workspace membership/RLS patterns (`supabase/migrations/20260806100000_workspace_account_persistence.sql:104`). New records also need a server-authorized account/source binding; a client-supplied account ID alone is insufficient. Minimize stored contact data: the proposed matching does not require raw phone/email fields in dashboard payloads.

Likely additions are an investigation/revision schema and API, a versioned funnel-view serializer, a typed source-outcome model and importer, and a cohort aggregation layer. Keep ingestion and aggregation server-side and bounded. Extend the existing PerformanceV2 panels and persistence/auth patterns rather than building a parallel dashboard.

Validate isolation, frozen revisions, amendments/retractions, mature/developing cohorts, unmatched attribution and payment/refund arithmetic. Preserve current denominator, tracked-zero and missing-data tests. Run targeted tests and scoped TypeScript sequentially under the 1 GB constraint, then one browser session for desktop/mobile and English/Vietnamese QA. A sample demo does not validate production access or live refresh; require one production read integration before claiming that source is supported.

## Sizing and decisions

These are rough engineering bands, not deadlines. Assuming one engineer, an existing usable Supabase deployment and one clean export: Release 1 is a few focused days; one outcome pilot roughly one to three engineering weeks; sharing/watch workflows roughly another one to three. Payment reconciliation and event identity can each exceed those bands. Source access and data cleanup can dominate elapsed time.

Decisions that change scope:

- First account/KPI pack and authoritative source with stable IDs.
- Qualification or paid-order definition, effective timestamps and observation window.
- Private-only versus workspace sharing. Recommended first release: private investigations.

**Next implementation slice:** Release 1 with persistence/isolation gates, plus a field-mapping/reconciliation exercise on one representative outcome export. Proceed to the pilot only after proving records can be matched and the chosen outcome answers a real business question.
