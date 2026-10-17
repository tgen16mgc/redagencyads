# Hypothesis redesign and clearer Funnel guidance

17 October 2026. Uses Impeccable's clarify playbook for the Funnel and its local Operate guidance for the Hypothesis component. Existing Performance identity, event/count semantics, session storage and experiment engine are preserved.

## Design references

Visually inspected in Mobbin before implementation:

- [Amplitude contextual experiment goals](https://mobbin.com/screens/fd9b5fa1-3efa-4999-8548-5c224a1ab3d2): keep task context and measurement intent together, with uncommon details disclosed when needed.
- [Linear compact issue composer](https://mobbin.com/screens/ffa2e456-85c7-4005-b361-de79dc6b6dc7): direct writing prompts, compact properties and one primary next action.

The result is an inline evidence rail beside a composer, stacked vertically on mobile. It adapts those patterns to the existing Geist, neutral surfaces, purple actions, 10px panels and 7px controls; it introduces no separate visual identity.

## Content and interaction changes

| Before | Now |
| --- | --- |
| Hypothesis and verification; a full-width evidence block followed by a long form | Hypothesis; current/comparison evidence beside the explanation and change, with provenance details expandable |
| Hypothesis, proposed change, guardrails | What could explain this? What will you change? What must not get worse? |
| Create test brief, then another planner action | Save hypothesis becomes Plan this test; edits require Save new version |
| Event ratio and pp without contextual explanation | Step rate plus How to read this funnel, defining numerator/base, repeated events, percentage points, comparison and next action |
| Statistical decimals such as 0.04 and 0.2 | Planner displays 4% and 20%, converts to the engine's existing fractions and explains relative improvement |
| All planner inputs visible together | Measurement and eligible volume first; confidence, power and allocation under Advanced settings |
| Aggregate evidence could be read as a causal explanation | Evidence explicitly says what happened; the explanation remains a possible cause, to be tested |

Persistent labels have associated descriptions and contextual examples. Invalid hypothesis submission announces the issue and focuses the first missing field. Saved hypotheses retain fixed evidence, cautions and eight scoped revisions; planner edits remain separate. Saved context can be expanded in the planner instead of pushing measurement fields far down the page.

## QA and review

Method: a sample-data cognitive walkthrough, not participant research. One batched desktop/mobile inspection and one correction/confirmation pass, following Impeccable's bounded workflow.

- Desktop English at 1440px, Vietnamese mobile at 390px, and dark mobile planner visually reviewed.
- Tested empty submission recovery, row-to-hypothesis context, save → plan, saved evidence/cautions, reopen/restored planner inputs and estimate reset after editing.
- Percentage conversion checked through the visible UI: 4% baseline, 20% effect, 95% confidence, 80% power, 50% test share and 100 daily observations still return 20,634 total observations / 207 days.
- Measurement inputs stay empty until entered. The planner blocks missing source/population/volume instead of deriving user probabilities from aggregate events.
- Mobile page and planner have no horizontal overflow; mobile control text uses 16px. Dialog Escape/recovery and accessible field names checked. No runtime errors observed.
- Review found an irrelevant form example on click-response findings and 4.29:1 supporting-text contrast on the muted rail. Both were fixed together. Contextual examples now match the finding; scoped muted text measures 4.77:1.
- Final disposition: **ship**. Fresh reviewer startup failed because its inherited model identifier was unavailable, so the separate review and verdict pass ran in-thread. This was not an independent participant or external reviewer assessment.

Engineering: 27 targeted tests passed across funnel-analysis, funnel-investigation and experiment-engine; scoped TypeScript and static integrated demo build passed. Detector returned no findings for the three changed TSX targets. `git diff --check` passed. Tests/build/browser ran sequentially under the 1 GB task RAM constraint. Full-project checks and live-account integration were not run.

## Limits and records

Saving is still session-only, scoped to the current tab/report, with no team sharing or server persistence. No CRM/device/landing-page connector, real experiment, budget change or deployment was added. Statistical estimates still require valid independent observations and a suitable randomization/measurement design.

The scoped visual/content record is `.impeccable/surfaces/components-dashboard-funnel-test-brief-tsx.md`; global DESIGN.md was preserved. The project has no PRODUCT.md; a broader Impeccable init remains an optional documentation follow-up, outside this local refinement.

Demo: http://localhost:4178/?custom → Funnel → select a segment → Hypothesis.

Proof files under ignored `tmp/funnel-redesign-qa/`: `hypothesis-final-desktop.jpg`, `hypothesis-final-mobile.jpg`, and first-pass planner/dark-mode captures. Review findings are recorded in `hypothesis-review.md` there.
