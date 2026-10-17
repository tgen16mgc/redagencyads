# Marketer workflow evidence for the Funnel tab

Research date: 17 October 2026. This document extracts a workflow from the supplied video and turns it into a prioritized product brief. It does not implement the proposed changes.

Follow-up: [implementation and task-based UX QA](funnel-workflow-implementation.md). The gap table below records the pre-implementation state; the follow-up identifies what is now delivered and which data/backend gaps remain.

## Source and method

- Source: [Hưng Lưu — five steps for reading marketing data](https://www.tiktok.com/@hungluuvn/video/7678693784628055303), 2 minutes 19 seconds.
- Reviewed all 40 extracted frames across the clip and the complete Vietnamese automatic speech-recognition captions. Captions were fetched with [Apify TikTok Transcript Extractor](https://apify.com/clockworks/tiktok-transcript-extractor) after the local downloader returned no subtitle files.
- [Apify run](https://console.apify.com/actors/runs/cwBcGuChSSUHtZrLH) · [dataset](https://console.apify.com/storage/datasets/BMeFNBVbFROFnobrj). One video returned; reported charge: $0.0037. Existing Vietnamese captions were available, so no paid transcription add-on was needed.
- Local working evidence: `tmp/watch-marketer-7678693784628055303/` contains the video, timestamped frame report, `captions.vi.vtt`, `transcript.vi.txt`, and Apify result metadata. These ignored working files are retained for follow-up. No API credential is stored in these files.

Evidence limits: this is one practitioner's instructional framework, not interviews or observed use of our product. ASR contains recognition errors; the visible labels clarify terms such as KPI, CTR, funnel, and hypothesis. Timestamp boundaries below are approximate. The video's illustrative numbers and Vodafone outcome claims are not independently verified, product benchmarks, or promised uplift.

## The workflow in the video

| Time | What the marketer does | Question they need answered | Product implication |
| --- | --- | --- | --- |
| 00:23–00:39 | Selects the main KPI; compares orders against a target or a previous period | Is the outcome improving or worsening, and against what? | Start with the actual goal, current value, comparable baseline, absolute/relative movement, and a separately identified business target if configured. |
| 00:39–01:02 | Breaks the KPI into an ordered path: impressions → clicks → landing page → cart → order | At which part of the path should I investigate? | Make the measurement relationships explicit; allow drill-down without changing the business question. A diagram alone does not prove a linked journey. |
| 01:02–01:19 | Compares individual metrics with history or an applicable benchmark; contrasts good CTR with worse landing-page-to-order results concentrated in mobile visitors | What is unusual, and in which segment? | Show stage comparisons and relevant segment dimensions together. Avoid diagnosing creative solely because the business outcome fell. |
| 01:19–01:32 | Suggests slow loading or a hard-to-find purchase button as possible explanations | What could explain the observation? | Separate observed facts from possible causes. The speaker explicitly says these are hypotheses, not conclusions. |
| 01:32–02:05 | Tests a change to loading speed or purchase-button visibility and evaluates the purchase/revenue outcome | What test would confirm or reject this hypothesis? | Carry the selected stage, segment, evidence, hypothesis, metric definition, and planned intervention into a test brief; connect results back to the investigation. |
| 02:05–02:13 | Restates the sequence rather than looking at every metric simultaneously | What should I inspect next? | Organize the UI around successive questions and preserve context at each transition. |

The speaker refers to a mobile-app segment while explaining a landing-page example. Treat this as a cue to investigate device/surface differences; the clip does not establish an exact device taxonomy or data source.

## Insights and gaps in our current implementation

The central need is to progress from a business question to a testable decision. More visible charts do not by themselves complete that workflow.

| Need implied by the source | What the checkout already supports | Specific remaining gap |
| --- | --- | --- |
| Start from the KPI problem | Primary outcome follows the KPI pack; spend and outcome cost are visible | The Funnel summary lacks the outcome's own current-vs-baseline count/cost movement. Its target control is a stage-rate scenario, not an account business target. Sales currently anchors on purchases even when the pack is named Sales / ROAS. |
| Find the unusual stage | Explicit denominators, baseline markers, pp changes, and a suggested focus | Focus ranks eligible rate declines, not contribution to the primary KPI. It can nominate falling CTR while the business goal improves. The chosen stage needs both count and rate comparison to distinguish volume from efficiency changes. |
| Find the affected segment | Campaign, ad-set and ad breakdowns, search and sorting | Funnel does not expose platform, geography or age/gender, although those aggregate rows already exist in `DashboardReport`. Device and landing-page conversion/load measurements are absent from this funnel report. Targeting settings saying mobile are not observed mobile-performance data. |
| Explain a possible cause | Short stage-specific guidance, evidence sheets and Setup/Creatives navigation | No editable hypothesis tied to the selected observation. Generic routing cannot distinguish a measurement gap from a suspected destination problem. Evidence and conjecture need different labels. |
| Verify and decide | Intelligence already has an experiment workspace, planner, assignment helpers, result evaluation and learning log | Funnel does not hand its current investigation into that workflow. The experiment workspace starts with unrelated defaults and receives only language. An experiment planner does not itself install a website variant or collect randomized outcomes. |

Current source references: `components/dashboard/performance-funnel.tsx` (summary, selected-stage inspector, breakdown and target scenario); `lib/funnel-analysis.ts` (canonical denominators and focus heuristic); `lib/types.ts` (`NormalizedRow`, `DashboardReport`); `lib/meta.ts` (platform, age/gender and region requests); `lib/ga4-attribution.ts` (channel-group key events/total revenue); `components/dashboard/experiment-workspace.tsx`, `components/dashboard/intelligence-workspace.tsx`, `lib/experiment-engine.ts` (existing experiment functionality).

## Recommended feature and UI changes

### First slice: strengthen diagnosis using available report data

1. **Improve the outcome summary.** Show current vs baseline outcome count, absolute and relative change, and cost alongside spend. Keep dates and comparison basis visible. A tracked zero baseline yields an absolute change and “relative change unavailable,” not infinity. Missing tracking stays unavailable. Surface a configured business target separately from the existing scenario; do not invent one. For Sales / ROAS, expose ROAS alongside purchase count and retain its source definition.
2. **Improve the selected-stage inspector.** Put current/baseline counts and the explicit rate denominator side by side. Call the suggestion an “Observed rate decline” or “Tracking gap.” Never call it the cause of a KPI change. When the primary goal improves but a stage ratio declines, say so; the user can still inspect it without receiving an unsupported negative verdict.
3. **Expand Find the source with available dimensions.** Retain Campaigns / Ad sets / Ads and add an explicit dimension selector for Platform, Region and Age / gender where report data supports the selected metric. Match comparisons by stable entity ID for entity rows and canonical dimension tuples for dimension rows; never by display name. Withhold changes when there is no usable baseline. Show unsupported dimensions as unavailable with a clear measurement requirement.

Keep the current visual system and progressive disclosure. Recommended order: **outcome and comparison → stage analysis → affected segment → hypothesis and verification → optional trends/scenario**. Do not add another general-purpose dashboard or force the framework into a five-step wizard.

### Second slice: connect a finding to verification

Add a compact **Hypothesis and verification** section after the source table. Its content should distinguish:

- **Observed:** selected metric, exact numerator/denominator, current/baseline values, dates, entity/dimension, source availability and event-volume caution.
- **Hypothesis:** editable possible explanation, clearly marked unverified; no prefilled “slow mobile page” claim without the required data.
- **Verify:** proposed change, suitable test method, primary outcome, guardrails, evidence still needed, and a clear next action such as **Create test brief**.

Extend the existing experiment workflow to accept a versioned investigation context rather than creating a separate experiment product. Prefill only compatible fields. Meta aggregate event ratios are not automatically valid binary user-conversion probabilities for its sample-size calculator; user/geo assignment and independent outcome measurements must be established before an experimental result can be claimed. A brief can be drafted while instrumentation is missing, but that state remains explicit.

Retain saved-investigation and immutable evidence revisions from [the existing unmet-needs plan](funnel-unmet-needs-plan.md). They make a hypothesis and later result reproducible; this video strengthens the reason for that work. Avoid adding owners, messaging or automatic ad changes to this first verification slice.

### Data-dependent work: enable the video's mobile landing-page diagnosis

To reproduce the video's example, add an explicit measurement contract for device/surface and landing pages: source, event definition, page identifier, dates/timezone, tracking coverage, comparable dimensions and historical availability. Page-load evidence needs actual performance telemetry; UI friction needs an appropriate review or research source. The existing GA4 channel-group revenue query supplies neither a device funnel nor page-load measurements.

Keep Meta aggregate efficiency separate from first-party session/user conversion. Do not divide a GA4 session numerator by Meta clicks and call it person conversion. Do not insert a synthetic landing-page step between current click/cart counts. A linked conversion funnel needs consistent identity, order, event deduplication and a completion window. Business-qualified outcomes and payments still follow their own source contracts.

## Add, improve, remove

| Add | Improve | Remove or avoid |
| --- | --- | --- |
| Outcome movement; supported segment dimensions; hypothesis/test-brief handoff; evidence-to-result link | Goal alignment; count plus rate comparisons; context preservation; source/availability labels | Unqualified causal wording; automatic creative blame; unrelated experiment defaults; copied market benchmarks; fabricated device/landing metrics; treating a target scenario as an experiment |

## Acceptance scenario for the next iteration

Use an explicitly labeled fixture, not a claim about the current account: the goal declines, CTR holds or improves, and a measured mobile landing-page conversion worsens.

The user should be able to identify the goal movement, select the relevant measured step, locate the affected mobile segment, record a possible explanation as unverified, and create a test brief without losing scope or metric definition. If mobile/page data is absent, the product must identify that limitation instead of presenting the same diagnosis. A later result can support, contradict or leave the hypothesis inconclusive; no pre/post aggregate comparison is automatically causal proof.

Verify missing baseline, tracked zero, tiny volumes, unavailable dimensions, changed scope and restored evidence. Review desktop/mobile, English/Vietnamese, keyboard access and the existing design system after implementation. This research-only turn changes documentation, not application behavior.
