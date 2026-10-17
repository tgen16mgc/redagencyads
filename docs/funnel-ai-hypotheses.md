# AI suggestions in Funnel Hypothesis

The marketer selects a funnel finding, asks for hypotheses, reviews the proposed explanations and tests, then applies one to the editable draft. Existing text requires an explicit Replace draft choice. Applying a suggestion does not save it or start an experiment. Save hypothesis and Plan this test retain their existing behaviour.

## Reference and adaptation

Mobbin Linear assistant reference, visually inspected: https://mobbin.com/screens/735580ba-5334-4377-8dd8-4338533d99af. The feature adapts its compact contextual assistant into the existing Performance system, beside the selected finding. Suggestions are a short list with expandable evidence and test details. The manual form remains available during requests and failures.

## Data and AI contract

- `POST /api/ai/funnel-hypotheses` reuses the server's configured OpenRouter or 9router gateway. Keys stay on the server.
- Existing workspace authentication/membership middleware covers `/api/ai/*`. Same-origin checking, rate limiting, request size limits and bounded schemas apply to this route.
- Requests contain the selected stage, segment name, dates, measurements, spend, sample/live source and preferred metric. Account IDs, tokens, full reports, campaign lists and existing draft prose are excluded.
- The server writes the displayed observation evidence. AI can reference only those evidence IDs; invented references and incomplete output are rejected. This bounds citations, but generated explanations still need human verification.
- The model must distinguish possible causes from facts, identify missing evidence, avoid unsupported trends, and distinguish repeated event ratios from person-level conversion and experimental baselines.
- Errors expose recoverable codes, never provider diagnostics. Missing configuration or provider failure is not replaced with fabricated AI output.
- Temporary OpenRouter model failures get one bounded fallback through `openrouter/free`; this never selects a paid fallback or changes the workspace's global model. Each attempt has a 35-second timeout. Operational logs contain provider status codes only, without report content or credentials.
- Requests cancel on segment/evidence/language changes or component unmount. A response never automatically overwrites a draft. A user must select a suggestion and review/save it.
- Saved drafts remain in the existing tab-session storage. AI suggestions themselves are not saved to a server.

## Validation

- 60 tests across seven targeted files passed, including API success, invalid/oversized requests, same-origin protection, rate limits, missing configuration, provider failure, timeout, invalid output, evidence references, free-model fallback and existing funnel/planner behaviour.
- Separate UI, API and test TypeScript scopes passed. A combined scope exceeded the 384 MB heap; splitting it resolved that limit. No full local Next build was attempted under the 1 GB constraint.
- The Vite UI build passed.
- Browser QA with explicitly temporary API fixtures covered desktop English, 390 px Vietnamese mobile, light/dark, evidence review, apply, draft replacement/cancellation, error preservation, request cancellation, segment changes, save and planner handoff. No horizontal overflow; mobile AI buttons are at least 44 px high. Fixtures were removed from service after QA and are not part of the application.

The initial production release `d27dd3b` passed Vercel's full Next build and deployed to https://redagencyads.vercel.app. An unauthenticated request to the new route correctly returned 401. The first authenticated AI smoke request reached OpenRouter twice but failed, motivating bounded free-model recovery and safe status diagnostics before final verification.
