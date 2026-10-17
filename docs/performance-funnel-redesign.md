# Performance funnel redesign

Implemented in `components/dashboard/performance-funnel.tsx`, shared by Performance Overview and Funnel. Analysis helpers live in `lib/funnel-analysis.ts`.

Latest delivery: [marketer workflow implementation and UX QA](funnel-workflow-implementation.md), including outcome comparisons, demographic/platform breakdowns, contextual test briefs and the reused experiment planner. That record supersedes the earlier validation counts and remaining feature gaps below.

## Reference and adaptation

Primary clone reference: [Mixpanel funnel report on Mobbin](https://mobbin.com/screens/647846ee-9587-4317-aecb-4abf5aece206). The inspected reference uses vertical step columns, conversion labels, a query inspector and a breakdown table. This implementation reproduces that report structure and adapts its content and interactions to advertising diagnosis. It uses the existing Overview system: Geist, neutral surfaces, 10px panels, 7px controls, existing purple chart tokens, existing dark theme, and the app's Button, tabs, entity and stage-evidence overlays. Reference imagery is not embedded in the product.

## User task and gaps

These needs are product hypotheses based on the supplied screenshot and the existing implementation, not interview findings.

| When opening Funnel, the user needs to… | Previous gap | Delivered change |
| --- | --- | --- |
| Understand the scope and outcome | Stage cards compete equally; no funnel-level context | Spend, primary KPI-pack outcome, suggested focus and comparison availability in one summary |
| See which step merits investigation | “Largest leak” inferred from generic warning status | Suggested focus prefers missing tracking, then the largest observed rate decline in percentage points with at least 30 denominator events; otherwise a stage to inspect, without causal claims |
| Understand what each rate means | A custom Conversation → Lead sequence could imply an unsupported relationship | Every step names its actual denominator; lead and conversation ratios independently use link clicks |
| Compare current performance | Movements mainly compare cost; no visible baseline on the funnel | Current ratio, baseline marker, percentage-point change, and existing comparison-mode labels |
| Explore a different stage | Cards immediately open a sheet while diagnosis stays fixed | Selecting a step updates the inspector, daily trend, target model and segment table together; evidence has its own action |
| Locate the source | Top three rows ranked by volume hide inefficient spend | Campaign/ad-set/ad switch, spend, ratio and rate-decline sorting, search, spend share, matched-ID rate changes, and additional rows in batches of 20 |
| Know what to inspect next | Arbitrary three-period hold advice | Stage-specific links to Creatives or Setup; segment comparison stays within the selected stage, and entity evidence retains its metric |
| Judge evidence quality | Confidence derived from overall account health | Missing tracking, untracked versus tracked zero, small denominators and unavailable comparisons are explicit |
| Understand trends | Generic outcome chart with a hidden cost axis under a stage diagnosis | Selected-stage daily rate, volume or cost on a single labeled axis; nulls remain gaps |
| Evaluate a possible improvement | No way to quantify a target | Editable target event ratio models the selected event at a fixed denominator; explicitly a scenario, without spend or downstream forecasts |
| Move from a summary into investigation | Overview ends with repeated status cards | Compact reference-based funnel report in Overview opens the full Funnel workspace |

## Data boundaries

- Meta aggregate counts are not a linked user cohort. No unique-person conversion, verified drop-off count or causal attribution is claimed.
- Supported ratios are clicks/impressions, conversations/clicks, leads/clicks, replies/conversations, carts/clicks, checkouts/carts and purchases/checkouts. Custom display ordering never changes these denominators.
- Reach, impressions and frequency remain delivery metrics. Awareness does not manufacture an end-to-end conversion rate.
- Ratios can exceed 100% because events can repeat or overlap. Labels retain the true ratio; column height stops at 100%, disclosed beside the chart.
- Zero denominators, missing outcomes and missing daily data yield unavailable values, not fake zero rates or generated trends. Outcome zeros require explicit tracking availability when no positive event exists.
- Segment changes compare matching IDs only. Unmatched campaign peers have no invented row-level baseline.
- The 30-event threshold is a UI caution rule, not a statistical confidence calculation. No significance claims are made.
- The scenario holds only the selected stage's denominator constant. Fractional event differences represent modeled expectations, not actual people or promises.
- Qualified-lead quality, CRM revenue, attribution windows, user-level journeys and automated budget execution require data beyond this report and are not simulated here.

## Validation

Targeted unit coverage verifies denominator integrity, tracking availability, zero handling, ratios above 100%, percentage-point comparisons, focus selection and scenario inputs. Browser QA uses the real integrated PerformanceV2 component in a static sample-data harness, with no live account writes. Screenshots and the downloaded reference are under ignored `tmp/funnel-redesign-qa/`.

- 33 tests passed across `funnel-analysis`, `performance-stages`, `performance-display` and `sample-report`, one worker, 256 MB Node heap.
- Scoped TypeScript check passed with a 384 MB heap. The initial 320 MB cap exhausted its heap; no full-project typecheck was attempted.
- Static integrated component build passed with a 320 MB heap, before running the browser.
- Browser checks passed for Overview → selected Funnel step, stage updates, scenario arithmetic and empty/invalid targets, search/clear, breakdown/sort, metric switching, entity/stage evidence, action navigation, missing comparison/day/event data, awareness and tracked zero. No runtime errors were observed.
- Visually reviewed English/Vietnamese desktop and mobile screenshots and dark mode. Page overflow checks passed at 320, 390, 1024 and 1440px. Step columns and the table intentionally scroll within their containers on mobile.
- The full Next.js production build and full test suite were not run under the 1 GB machine constraint. No deployment or live-account mutation was performed.

## Task-based demo review, 17 October 2026

Method: an expert cognitive walkthrough using the evaluate skill, acting as an ads manager asking: “Are results worsening, where is the change coming from, and what should I inspect before changing spend?” This was a single evaluator using sample data, not a participant study or evidence that every user need is covered. Desktop and a 390px viewport were exercised through the visible UI.

Severity: 3 = major decision or task failure; 2 = recoverable friction; 1 = minor. These are prioritization judgments, not measured usability scores.

| Observed issue | Severity | Impact and correction |
| --- | --- | --- |
| Messages scope summarized Leads because it was the last custom step | 3 | Confused the report goal. Summary now uses the primary KPI-pack outcome and its cost independently of display order. |
| Lead evidence said Conversation → Lead while the actual denominator was link clicks | 3 | Implied an unsupported relationship. Custom stage ordering now preserves canonical evidence relationships. |
| Three leads received a “Sufficient data” badge | 3 | Implied confidence from tracking availability. Evidence now says Low event volume or Events recorded; the inspector warns about few outcomes and unavailable CRM quality. |
| Compare segments opened Drivers ranked by Messages while investigating Leads | 3 | Changed the question without warning. It now scrolls and moves focus to the selected-stage table. |
| Returning from another tab reset the investigation | 2 | Required repeating stage selection, filters and target edits. Stage, level, search, sort, trend and target are held in PerformanceV2; scope changes reset them. |
| Ad evidence showed a generic Healthy badge based on frequency and repeated the ad spend at every hierarchy level | 3 | Could make a low-volume ad appear reliable and misstate campaign spend. Funnel entry now shows selected-stage count, explicit ratio, cost, matched-ID change and volume caution. The chain uses actual matching report rows and each row's spend. Generic frequency alone no longer assigns health. |
| Improved stages defaulted to a worse previous rate in the target model | 2 | Suggested a negative improvement. Default is the better of current and valid baseline, rounded upward to the visible precision. |
| Suggested focus did not explain its selection | 2 | Made prioritization opaque. The summary now names missing tracking, largest eligible pp decline, or a starting-point fallback. The 30-denominator-event eligibility rule remains a UI rule, not significance or business-impact ranking. |
| No ad breakdown or rate-decline sorting | 2 | Slowed source discovery. Added Ads and Biggest rate decline, plus parent-name search and explicit unmatched-baseline guidance. |
| Mobile analysis and offscreen table columns were hard to discover | 2 | Added Analyze selected step, a table swipe hint, a sticky name column and larger touch controls. |
| Daily sample rows rounded three leads down to zero across every day | 3 | Contradicted report totals. Sample allocation now conserves additive totals and carries tracking availability to each day. These are explicitly modeled sample days; live trends remain source-backed. |
| Demo Edit scope only displayed a receipt message | 2 | Prevented exercising a core task. The ignored demo harness now supports campaign, dates, primary KPI, comparison and funnel-step selection. Production scope controls are in AdsWorkspace and were source-inspected, not tested against a live account here. |

### Retested tasks

- Overview Lead step opens the full Lead investigation while the summary correctly stays on Conversations for the Messages KPI pack.
- Lead evidence retains Link clicks → Leads and explains why three events do not establish confidence.
- Compare segments keeps Leads selected and moves focus to Find the source.
- Ad-level search, rate-decline sort and target editing work together. A 1% target at 1,898 clicks models about 16 additional leads, explicitly a scenario.
- Switching to Setup and returning preserves Leads, Ads, search, decline sort and target input.
- Changing the sample scope to Sales with comparison off shows unavailable tracking and offers comparison recovery, instead of inventing zeros or rates.
- On mobile, the selected-step jump reaches its inspector and source comparison reaches the horizontally scrolling table. Vietnamese at 390px has no page-level horizontal overflow; the 900px inspector and desktop dark theme were visually reviewed.
- Ad evidence retains the Lead question: 2 leads / 1,064 clicks, 0.19%, cost about 934,434 VND, +0.03 pp. Campaign spend is about 3.4M VND; the selected ad set and ad each show about 1.9M VND from their own rows.
- After the evidence-sheet change, the scoped TypeScript check (including the demo entry point) and static build passed again.

### Remaining product needs

1. **Business quality:** CRM-qualified leads, sales stages and realized revenue are absent. Meta lead counts cannot answer whether the leads are useful. Surface this gap and connect CRM outcomes before offering quality-based recommendations.
2. **Actual user journeys:** linked cohorts, conversion windows and time-to-convert require event identity and attribution metadata. This funnel is an aggregate event-ratio analysis; it cannot establish unique-user abandonment or causality.
3. **Ongoing collaboration:** this walkthrough does not establish saved/shareable funnel views, annotations, alerting or owner-and-due-date action tracking. Prioritize these with real users after the core diagnosis flow.
4. **Production integration:** the demo uses sample data with a modeled comparison. Live refresh, account permissions, production scope persistence, PDF generation and CRM/budget writes were not validated in this walkthrough.

Verdict: suitable for reviewing Meta delivery, event efficiency and segment differences. It is not yet a complete end-to-end sales-funnel tool. The next highest-value capability is CRM-qualified outcomes, followed by cohort/time-window analysis when the required data exists.

## Follow-up implementation plan

See [Plan to close the Funnel tab's unmet needs](funnel-unmet-needs-plan.md), prepared after an independent GPT-6 Astra review with fresh context and high reasoning. That review found existing report snapshots, GA4 channel-group key events/total revenue, budget alerts and action audit infrastructure. The next work should extend those capabilities with reproducible investigations and properly matched business outcomes; it should not assume all persistence, revenue or action infrastructure is absent. GA4 total revenue and Meta ROAS do not replace a qualified-lead or payment/refund source.

The [marketer workflow research brief](funnel-marketer-workflow-research.md) adds timestamped evidence from the supplied Hưng Lưu video. It prioritizes outcome comparison, count-and-rate diagnosis, supported segment dimensions, and an editable hypothesis passed into the existing experiment workflow. Device and landing-page diagnosis remains dependent on additional measurement data. These recommendations are not yet implemented.

## Funnel usability refinement, 17 October 2026

This pass implements the approved tab-level refinement. Find the source now follows the selected-stage analysis directly. Daily trends and target scenarios sit below the table in a collapsed-by-default Trends and targets section. Its expansion state, trend metric and target remain in the investigation state when switching tabs; charts mount only while expanded.

The inspector retains one primary stage action and a secondary evidence link. Short, visible badges distinguish low event volume, recorded zero and unavailable lead quality; tracking gaps remain visible in the stage status. Longer methodology and evidence-quality explanations are available through keyboard-accessible native Details disclosures. The aggregate-event caveat, actual denominators, unavailable values and scenario assumptions remain explicit. The tablet inspector now groups metrics and guidance in two columns, stacking them on mobile.

Validation for this pass:

- All 33 targeted tests passed with one worker and a 256 MB heap. The scoped TypeScript check passed at 384 MB; the integrated static demo build passed at 320 MB. Commands ran sequentially before browser review.
- Browser checks covered Overview to selected Lead stage, source navigation/focus, entity evidence retaining Leads / Link clicks, keyboard disclosures, target validation, trend controls, collapse/reopen and preservation of stage, level, search, sort, trend, target and expansion across tab switches.
- Reviewed English and Vietnamese at 390px, the regrouped Vietnamese inspector at 900px, desktop and dark theme. No page overflow at 390px. Optional charts rendered at nonzero width after expansion and resizing. Tracked zero, missing daily data, unavailable comparison and missing sales tracking retained their distinct states; Check setup opened Setup.
- No application console errors were captured in the final review tab. The full Next.js build, full test suite and live-account integration remain untested under the 1 GB resource limit.

Demo: `http://localhost:4178/?custom` (sample data). Updated proof: `tmp/funnel-redesign-qa/funnel-refinement-final.png`; Vietnamese mobile proof: `tmp/funnel-redesign-qa/funnel-refinement-mobile.png`.
