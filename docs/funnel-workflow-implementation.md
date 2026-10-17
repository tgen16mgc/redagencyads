# Funnel investigation implementation and UX QA

17 October 2026. Builds on [the video research](funnel-marketer-workflow-research.md) and the existing Funnel redesign. Preserve aggregate-event denominators, existing data/actions and the Overview visual system.

Latest UI/content refinement: [Hypothesis redesign and clearer Funnel guidance](funnel-hypothesis-clarity.md).

## Delivery plan

1. Put the business outcome before stage diagnosis: current/baseline outcome counts, spend, outcome cost and Sales ROAS, with absolute/relative movement and visible comparison dates. Display configured CPA/ROAS targets separately from stage-rate scenarios.
2. Expose current/baseline counts, denominators and rates together. Explain that suggested focus is an observed rate decline, not a causal or business-impact ranking. Point out when the main outcome holds/improves despite a declining stage rate.
3. Add platform, region and age/gender to the source table. Compare entities by stable ID and dimensions by canonical tuples; ambiguous matches remain unavailable. Let a selected row become the subject of an investigation. Explicitly identify missing device/landing-page measurement.
4. Add a contextual hypothesis and verification brief: immutable observed evidence, editable hypothesis, proposed change, primary metric and guardrails. Keep drafts separate for different findings. Save explicit revisions in this browser session and restore them for the same account/report scope.
5. Open the existing experiment designer in a focused planning mode with the brief attached. Require independent measurement inputs; never substitute aggregate Meta event ratios for user-level experimental baselines. Planning calculates sample size locally and does not install variants, assign users or claim results.
6. Run targeted analytics/storage tests and scoped TypeScript/static-demo checks sequentially. Walk through real visible UI tasks on desktop and narrow screens in English/Vietnamese and dark mode. Fix observed failures, then retest affected tasks.

## Mobbin references inspected before implementation

- [Mixpanel table breakdown](https://mobbin.com/screens/73fca992-7336-40a0-9456-8e1f1aeefd13): dimension columns, comparison controls, search and compact table. Adapt the dimension selector to the existing source table; keep scope visible.
- [Mixpanel grouped comparison](https://mobbin.com/screens/da21f2ca-4218-4f4c-862a-439102d9c0b9): explicitly grouped dimensions and labeled values. Reuse the clarity of dimension/value relationships rather than adding another chart.
- [Amplitude experiment goals panel](https://mobbin.com/screens/ca6343dc-5877-4aac-9c32-7a865c60425b): metric choice, success goal and guardrail intent remain beside the experiment context. Adapt that relationship into a compact brief and focused planner; retain our current components, typography, tokens and spacing.
- Existing [Mixpanel funnel report](https://mobbin.com/screens/647846ee-9587-4317-aecb-4abf5aece206) continues to inform the step columns and inspector.

## QA tasks and acceptance

Act as a marketer asking: “Are my results worsening, which stage and segment should I inspect, and how can I verify a possible explanation?” This is an expert cognitive walkthrough, not participant research.

- Read outcome movement and comparison dates without opening a sheet. Distinguish missing values, tracked zeros and an unusable zero baseline.
- Inspect a stage with declining volume but improving efficiency; do not receive an unsupported causal verdict.
- Change source dimensions, search, sort, select a segment, inspect evidence and return without silently changing scope. Match reordered dimension rows correctly and withhold ambiguous comparisons.
- Record a hypothesis and intervention. Switch stages/tabs, restore the original draft, save a revision and reopen the exact evidence. Missing storage must produce a recoverable message.
- Open the existing planner with matching context and metric. Block planning when measurement definitions/inputs are missing. No result or assignment controls in planning mode.
- At 390px and tablet width: labels, values and controls remain readable; intentional table scrolling is contained. Keyboard controls and dialog focus/escape work. Review Vietnamese and dark mode.

## Results

Implemented the six steps above. The source table now supports campaign, ad set, ad, platform, region and age/gender. Device remains an explicit missing-data state with a Setup recovery action. Selecting a row scopes its investigation evidence; the summary clearly remains the full report scope.

The brief records observed counts, denominators, rates, dates, spend, event cost, source, campaign scope and cautions separately from the marketer's unverified hypothesis. Up to eight explicit revisions are retained per report scope in browser session storage. Planner edits are stored separately from immutable evidence. The existing experiment designer is reused in planning-only mode, with independently measured baseline/variation and eligible volume required before calculation.

### Walkthrough findings and fixes

Severity: 3 = major task failure, 2 = recoverable friction, 1 = minor. Scores are evaluator judgments from a sample-data cognitive walkthrough, not measured participant outcomes.

| Observed problem | Severity / heuristic | Fix and retest |
| --- | --- | --- |
| Closing the planner discarded entered measurement inputs | 3 · H3 control, H7 efficiency · journey/fortify | Save planner inputs by brief ID in the browser session. Close/reopen and language navigation restore them. |
| A saved brief omitted the low-volume warning | 3 · H1 status, H6 recognition · fortify | Retain volume, tracking and lead-quality cautions beside saved evidence, including spend, cost and campaign scope. Reopened Instagram Lead shows 1 event and the caution. |
| Selecting a segment expanded an offscreen brief | 2 · H6 recognition · journey/include | Scroll and move focus to the investigation. The mobile walkthrough reaches the selected segment without searching down the page. |
| Invalid measurement inputs could yield unusable sample/day estimates | 3 · H5 prevention, H9 recovery · fortify | Require finite, valid measurement inputs; display unavailable estimates for invalid plans. Input changes clear the previous estimate. Valid continuous and binary examples calculate locally. |
| Planner fields lacked explicit label associations | 2 · H4 consistency · include | Associate core labels and controls. Field names are exposed to role-based/keyboard interactions in EN/VI. Escape closes the dialog and returns focus. |
| Vietnamese validation exposed an English engine message | 2 · H2 language, H9 recovery · articulate | Validate planning inputs with localized instructions before calculation. Verified a Vietnamese baseline recovery message and successful corrected input. |
| Planner portal inherited a different accent from Overview | 1 · H4 consistency · transpose | Apply the existing Performance color and focus tokens to the dialog, with its existing radius and components. Verified purple action styling and dark mode. |

### Accepted tasks

- Overview Lead opens the full Funnel with the selected stage while the primary outcome still follows the Messages KPI pack.
- Read outcome/count/cost/spend/date comparisons and applied CPA/ROAS targets. A tracked zero baseline shows an absolute change with relative change unavailable; disabling comparison removes table movement values.
- Investigate lower volume with an improving event ratio: the inspector exposes both numerator and denominator changes and explains the distinction.
- Change entity and demographic dimensions, search, sort, select a segment, inspect entity evidence and return. Reordered synthetic baseline IDs do not break canonical dimension matching. Ambiguous or absent matches remain unavailable.
- Create/reopen a saved brief, retain low-volume/quality cautions, switch stages/tabs without mixing drafts, and reopen planner inputs. Device data explains the measurement gap and links to Setup.
- Block incomplete planning inputs, calculate from independent fixtures, and remove the stale plan when inputs change. The continuous fixture (mean 50,000, SD 20,000, 100 daily units, relative effect 0.2, confidence 0.95, power 0.8) returns 126 samples / 2 days. A binary fixture with baseline 0.04 returns 20,634 samples / 207 days at 100 daily units.
- Existing optional trends, stage-rate scenario and entity Evidence action still work. A Conversations target of 8% over 1,898 clicks models +30.8 events, explicitly as a scenario.
- English/Vietnamese desktop, 900px tablet, 390px mobile and dark mode reviewed visually. Additional 320px checks show no page or planner horizontal overflow. Source tables scroll internally. No runtime console errors were observed in the final walkthrough.

### Engineering validation and limits

- 51 targeted tests passed across six files: funnel analysis/investigation, performance stages/display, sample report and experiment engine; one worker, 256 MB Node heap.
- Scoped PerformanceV2/demo TypeScript check passed with a 384 MB heap. Static integrated demo build passed with a 320 MB heap. Checks and browser work ran sequentially under the 1 GB task budget.
- `git diff --check` passed. The full Next.js build, full-project typecheck and full test suite were not run. The production AdsWorkspace target wiring was source-reviewed; live-account integration was not exercised.
- Persistence is session-only, with up to eight saved revisions per scope. There is no server-saved investigation, sharing workflow or experiment-result connection in this delivery.
- No device, landing-page telemetry, CRM qualification or revenue connector was added. Reported aggregate ad events remain distinct from linked user journeys and experimental measurements. ROAS without positive reported coverage is conservatively unavailable because the current model lacks an explicit revenue-availability flag.
- No live ad-account changes, budget actions or randomized experiments were executed. Sample fixtures demonstrate interaction and arithmetic, not real performance conclusions.

Demo: `http://localhost:4178/?custom`. Screenshots and the sample harness remain under ignored `tmp/funnel-redesign-qa/`.
