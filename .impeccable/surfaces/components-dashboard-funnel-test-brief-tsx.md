---
version: 1
slug: "components-dashboard-funnel-test-brief-tsx"
primary_target: "components/dashboard/funnel-test-brief.tsx"
related_targets: ["components/dashboard/performance-funnel.tsx","components/dashboard/experiment-workspace.tsx"]
---

# Funnel hypothesis

Mode: Operate. Local feature inside Performance; inherit the surrounding visual world. This is a scoped clarification and feature composition change, not a product rebrand. Existing DESIGN.md remains unchanged; PRODUCT.md is not required to deliver this narrow refinement.

## Purpose

Help a marketer turn an observed stage or segment result into one possible explanation and a testable change. Evidence must remain distinguishable from the hypothesis. Success is saving the hypothesis with fixed evidence, then estimating a test from valid, independently measured inputs.

## Built structure

- One inline work surface with a 300px neutral evidence rail and flexible composer above 1100px. At narrower widths, evidence precedes the composer. A single structural divider replaces nested evidence cards.
- The evidence rail shows the segment and metric, current/comparison rates or counts, explicit numerators/denominators, dates, and volume/tracking/quality cautions. Account, campaign, spend, cost and source interpretation expand under Data and scope details.
- Persistent prompts ask what could explain the result, what will change, the main success metric and what must not get worse. Examples are illustrative, never inserted as a real explanation.
- Save hypothesis is the sole primary form action. After save it becomes Plan this test; edits require saving a new version. Required-field recovery moves focus to the first missing field.
- Saved hypotheses expose up to eight revisions per report scope in the current tab session. Review and plan opens the exact evidence plus a separate editable planner. No sharing or server persistence is implied.
- The existing planner uses protected focus in its existing dialog, with saved context disclosed above. Measurement source, metric, baseline, variation and daily eligible volume are the main inputs. Statistical and assignment settings are progressive. Percentages display as familiar whole percentages and convert to fractions for the unchanged engine.

## Visual rules observed

Geist; restrained neutral surfaces with existing Performance purple action tokens (#605deb light; #aaa8ff dark). Scoped light supporting text is #686e7e, giving 4.77:1 on #f7f7fa. 10px outer surface/dialog and 7px controls preserve the current Performance system. 12px helper text, 13px labels, 16px section title, 22px evidence figures. Mobile fields use 16px text and actions at least 44px high. Borders establish hierarchy; no decorative elevation or motion. Reduced-motion disables the disclosure transition.

## Content rules

Define step rate, percentage points, comparison and next action in How to read this funnel. Label a missing value as unavailable, never zero. State that repeated events are not a person-level journey. Explain that saved hypotheses and what-if estimates do not execute changes. Use percentage examples beside planner fields and preserve the same measurement unit across baseline and daily volume.

## References inspected

- Amplitude contextual Goals: https://mobbin.com/screens/fd9b5fa1-3efa-4999-8548-5c224a1ab3d2
- Linear compact composer: https://mobbin.com/screens/ffa2e456-85c7-4005-b361-de79dc6b6dc7

The adaptation borrows context beside the task, grouped metric intent and a compact primary action. The surrounding Performance identity remains the authority.

## Boundaries

No device, landing-page or CRM connector; no experiment assignment/execution; no server storage. No identity change or global DESIGN.md refresh. Global documentation drift is outside this feature request.

## AI assistance

The inline assistant offers possible explanations and test drafts from the selected finding. It uses the existing server AI gateway and authentication. Reviewable suggestions, missing-evidence disclosures, explicit replacement of existing text, cancellation and recoverable errors preserve the manual workflow. Mobbin Linear assistant reference: https://mobbin.com/screens/735580ba-5334-4377-8dd8-4338533d99af. AI output is never treated as an established cause or an executed experiment.
