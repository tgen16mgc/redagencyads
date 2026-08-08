# Decision Operations Workspace

Next.js dashboard for campaign-first Meta Ads analysis, deterministic Verdicts, optional AI enhancement, PDF export, bilingual UI, and competitor ad-library spy work.

## Product Map

User sees one app with two work areas:

- `Ads analysis`: connect Meta token, choose ad account, choose campaign scope, pull Meta insights, inspect KPI cards/charts/tables, generate Verdict + insight table, export print/PDF report.
- `Competitor analysis`: enter competitor names plus ad-library notes you verified, then generate a competitive readout and original test briefs. Automatic fetching is temporarily paused after relevance testing failed.
- `TikTok intelligence`: fetch TikTok profile/video metadata plus public Ad Library and Creative Center creatives through Apify for creative and competitor analysis.
- Global `EN / VI` toggle: one persisted language control for app chrome, report panels, controls, and generated report text. Raw Meta account/campaign names and fetched competitor ad copy are not translated.

Core domain words:

- `MetaAccount`: ad account returned by `/me/adaccounts`.
- `MetaCampaign`: campaign metadata used for scope selection.
- `Campaign scope`: selected campaign IDs. Empty selection means all active campaigns.
- `InsightRow`: raw-ish Meta insights row from Graph API.
- `NormalizedRow`: local normalized metric shape used everywhere in UI, health checks, charts, tables, and prompts.
- `KpiPack`: KPI lens for report: `messages`, `lead_gen`, `sales_roas`, `traffic`, or `awareness`.
- `DashboardReport`: full report payload sent from server to dashboard.
- `Health checks`: account scoring rules for CTR, frequency, creative volume, campaign consolidation.
- `Verdict`: JSON strategy summary from structured report data. It is canonical app language; AI is only one optional enhancement source.
- `Prompt Verdict Source`: deterministic local Verdict generation. It never calls an AI provider.
- `Auto Verdict Source`: reliable-first Verdict generation. It creates the local Verdict first, optionally asks 9router to enhance wording when `NINEROUTER_KEY` exists.
- `AI insights`: JSON table-ready analysis, optionally with comparison deltas.
- `CompetitorSpyAd`: normalized ad-library row from Apify or Meta official API.
- `CompetitorSpyResult`: JSON competitive intelligence output.
- `TikTokProfileResult`: TikTok profile and video metadata from Apify.
- `TikTokLibraryReport`: public TikTok Ad Library intelligence from Apify. It is not owned TikTok Ads Manager performance.

## shadcn/ui Context

The project has the `shadcn` skill installed at `.agents/skills/shadcn`. Use it when touching UI components, component registries, presets, or anything under `components/ui/*`.

Current `npx shadcn@latest info --json` context:

- Framework: Next.js App Router, React Server Components enabled, TypeScript.
- Tailwind: v4, global CSS at `app/globals.css`.
- Style: `base-nova`.
- Base library: `base` primitives, not Radix.
- Icon library: `lucide`.
- Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`, `@/lib/utils`.
- UI path: `components/ui`.
- Installed components: `alert`, `badge`, `button`, `card`, `chart`, `empty`, `field`, `input`, `label`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `spinner`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`.

Rules to preserve:

- Use existing shadcn components first; check `components/ui` and `npx shadcn@latest docs <component>` before inventing markup.
- Forms use `FieldGroup` + `Field`; validation uses `data-invalid` on `Field` and `aria-invalid` on control.
- Option sets should use `ToggleGroup` when that component is installed; otherwise install via CLI before using it.
- Use semantic tokens like `bg-background`, `text-muted-foreground`, `border-border`; avoid raw color utilities for component styling.
- Use `gap-*`, not `space-x-*` or `space-y-*`.
- Icons inside `Button` use `data-icon="inline-start"` or `data-icon="inline-end"` and no manual icon sizing.
- Keep `SelectItem` inside `SelectGroup`, `TabsTrigger` inside `TabsList`, and use full Card composition.
- Use `Alert`, `Empty`, `Badge`, `Separator`, `Skeleton`, and `Spinner` instead of custom replacements.

## Architecture

```text
app/page.tsx
  -> components/dashboard-shell.tsx
      -> app/api/session
      -> app/api/meta/accounts
      -> app/api/meta/campaigns
      -> app/api/meta/report
      -> app/api/ai/verdict
      -> app/api/ai/insights
      -> app/api/spy/meta
      -> app/api/tiktok/profiles
      -> app/api/tiktok/ads
      -> app/api/ai/competitor

app/api/*
  -> lib/session.ts
  -> lib/meta.ts
  -> lib/metrics.ts
  -> lib/ai.ts
  -> lib/competitor-spy.ts
  -> lib/tiktok.ts
  -> lib/apify.ts
  -> lib/types.ts
```

Routes stay thin. Domain logic lives in `lib/*`. UI workflow state lives in `components/dashboard-shell.tsx`.

## Main Flows

### 1. Token Session

`components/dashboard-shell.tsx` starts by calling `GET /api/session`.

- `POST /api/session` validates pasted Meta access token through `validateToken()`.
- `lib/session.ts` encrypts token with AES-256-GCM using `SESSION_SECRET`.
- Token is encrypted, bound to the signed-in workspace account, and stored in the `meta_ads_session` HttpOnly cookie for up to 30 days. Workspace sign-out preserves it; the explicit Forget Meta action removes it.
- `DELETE /api/session` clears cookie and resets dashboard state.

Call path:

```text
TokenScreen
  -> POST /api/session
    -> lib/meta.validateToken()
    -> lib/session.setTokenCookie()
```

### 2. Meta Report

After session exists, dashboard loads accounts and campaigns.

```text
DashboardShell.loadAccounts()
  -> GET /api/meta/accounts
    -> lib/session.requireToken()
    -> lib/meta.getAccounts()

accountId change
  -> GET /api/meta/campaigns?accountId=...
    -> lib/meta.getCampaigns()
```

When user clicks `Pull report`:

```text
DashboardShell.pullReport()
  -> GET /api/meta/report
    -> lib/meta.buildReport()
      -> getAccounts()
      -> getCampaigns()
      -> getInsights(level: campaign)
      -> getInsights(level: adset)
      -> getInsights(level: ad)
      -> getInsights(time_increment: 1)
      -> getInsights(breakdowns: publisher_platform)
      -> getInsights(breakdowns: age,gender)
      -> lib/metrics.normalizeRows()
      -> lib/metrics.sumRows()
      -> lib/metrics.detectKpiPack()
      -> lib/metrics.scoreHealth()
      -> lib/metrics.buildPrompt()
```

`DashboardReport` returns KPI cards, totals, rows, health checks, and a legacy prompt string.

### 3. Comparison

Compare modes live client-side:

- `off`: no previous range.
- `wow`: previous same-length range, one week earlier.
- `mom`: previous same-length range, one month earlier.
- `yoy`: previous same-length range, one year earlier.

Dashboard pulls second report for comparison, then `comparisonDeltas()` computes deltas for AI insight prompt and comparison cards.

### 4. Verdict + Insights

The Verdict route uses structured report input as its canonical contract. Legacy prompt-only input still exists for compatibility, but prompt mode means local deterministic Verdict, not a model call.

```text
Run Verdict
  -> POST /api/ai/verdict
    -> lib/ai.generateVerdict()

Run insight table
  -> POST /api/ai/insights
    -> lib/metrics.buildInsightPrompt()
    -> lib/ai.generateInsights()
```

Provider behavior:

- `prompt`: return a complete local Verdict from structured report data. No model call.
- `auto`: generate local Verdict first; if `NINEROUTER_KEY` exists, ask 9router to rewrite/enhance that Verdict.
- `9router`: explicit 9router enhancement path using `NINEROUTER_URL` and `NINEROUTER_KEY`.

9router enhancement may improve wording, prioritization language, and Vietnamese phrasing, but local ads rules own the strategic claims. Enhancement cannot raise confidence above the local Verdict and cannot add budget moves over the 20% guardrail. If 9router fails, the app returns the local Verdict with an assumption explaining the failure.

### 5. Competitor Spy

The current UI analyzes manually verified ad-library notes. Automatic fetching is temporarily removed because the public scrape mixed unrelated advertisers into results.

```text
Generate competitor report
  -> POST /api/ai/competitor
    -> lib/metrics.buildCompetitorSpyPrompt()
    -> lib/ai.generateCompetitorSpy()
```

The `/api/spy/meta` route remains available for repair work but is not exposed in the product lifecycle until advertiser relevance and provenance checks pass.

### 6. TikTok Intelligence

TikTok profile/video data is fetched through Apify and stays separate from the owned Meta report contract. Ad Library search is active: EEA/UK/CH markets route to the Commercial Content Library and other markets route to Creative Center through the default global actor.

```text
Fetch TikTok profiles
  -> POST /api/tiktok/profiles
    -> lib/tiktok.fetchTikTokProfiles()
      -> lib/apify.runApifyActor()
      -> clockworks/tiktok-profile-scraper
      -> normalize into TikTokProfileResult

Fetch TikTok ad library rows
  -> POST /api/tiktok/ads
    -> lib/tiktok.fetchTikTokAdLibrary()
      -> lib/apify.runApifyActor()
      -> brilliant_gum/tiktok-ads-library-scraper by default
      -> normalize into TikTokLibraryReport
```

TikTok Ad Library rows are public creative/intelligence data. They may include public ranges such as spend, reach, impressions, audience, targeting, or sponsor fields depending on the actor, but they are not treated as owned TikTok Ads Manager performance.

#### TikTok live acceptance

The TikTok workspace includes a five-gate live-acceptance card. It reads `GET /api/tiktok/acceptance` and deliberately separates implemented product paths, anonymous measurements, and certified production proof. Evidence defaults to `.data/tiktok-acceptance.json`; set `TIKTOK_ACCEPTANCE_PATH` to a persistent mounted path, configure a dedicated `TIKTOK_ACCEPTANCE_TOKEN`, and set `TIKTOK_ACCEPTANCE_ENVIRONMENT=production` in the production deployment.

Each validation route returns its latest measured result. It writes release evidence only when the request supplies the dedicated acceptance token; ordinary product requests and anonymous validation calls cannot change gate status:

- `POST /api/tiktok/coverage`: advertiser-handle coverage and whether the approved CCL/partner feed actually served the cohort.
- `POST /api/tiktok/ads`: raw-to-normalized pipeline timing. Deduplication remains unproven here because checking already-deduplicated output is not an accuracy test.
- `POST /api/tiktok/deduplication/validate`: labeled rows shaped as `{ expectedCreativeId, row }`; reports duplicate-pair precision, recall, and F1 and passes only above `0.99`.
- `POST /api/tiktok/ads/search`: records the 10,000+ row search benchmark and two-second gate.
- `GET /api/cron/tiktok-digest`: records the successful delivery channels, actual local delivery hour, and timezone only after at least one webhook succeeds.
- `POST /api/tiktok/scoring/validate`: requires an ISO `observedAt` on every `{ score, cpa }` observation and passes only when `|r| > 0.6` across an inclusive window of at least 30 days.

The CLI calls the same API surfaces, so measurements can be inspected safely before a deliberate certification run:

```bash
node scripts/tiktok-acceptance.mjs status
node scripts/tiktok-acceptance.mjs coverage tmp/tiktok-coverage.json
node scripts/tiktok-acceptance.mjs ingestion tmp/tiktok-ingestion.json
node scripts/tiktok-acceptance.mjs deduplication tmp/tiktok-deduplication.json
node scripts/tiktok-acceptance.mjs search tmp/tiktok-search-benchmark.json
node scripts/tiktok-acceptance.mjs scoring tmp/tiktok-score-cpa.json
```

To certify a production cohort, set `DECISION_WORKSPACE_URL` and `TIKTOK_ACCEPTANCE_TOKEN`, then add both `--record` and a traceable `--cohort` label:

```bash
node scripts/tiktok-acceptance.mjs scoring tmp/tiktok-score-cpa.json \
  --record \
  --cohort client-cpa-2026-07-29 \
  --require-pass
```

`--require-pass` returns exit code `2` when the measured gate is not met. `--record` returns exit code `3` when certification was requested but the server did not record it. HTTP, configuration, and input failures return exit code `1`. See `docs/tiktok-live-acceptance-runbook.md` for the production sequence and cohort contracts.

### Decision Workspace completion readiness

The complete set of 20 production-only gates is exposed at `GET /api/readiness`. The snapshot separates missing configuration, missing production evidence, measured failures, and passed gates without returning secret values.

```bash
npm run verify:decision-workspace
npm run verify:decision-workspace -- --json
npm run verify:decision-workspace -- --require-complete
```

`--require-complete` returns exit code `2` until every gate has production evidence. Browser-session checks can be included by setting `DECISION_WORKSPACE_COOKIE` to an authenticated request cookie. Use `DECISION_WORKSPACE_URL` to target a deployed workspace.

Non-TikTok production evidence is recorded through `POST /api/readiness` with `Authorization: Bearer $DECISION_WORKSPACE_ACCEPTANCE_TOKEN`. Each record requires a known requirement ID, timestamp, result, summary, and either an evidence URL or run ID. Evidence only passes a gate when it was recorded with `DECISION_WORKSPACE_ACCEPTANCE_ENVIRONMENT=production`; local attestations remain visible but cannot complete the workspace.

### 7. Cross-channel intelligence foundation

The Intelligence workspace now exposes a canonical `schemaVersion: "1.0"` layer. Meta campaign rows normalize into owned performance records (spend, impressions, clicks, conversions, revenue, and ROAS), while TikTok rows normalize into public creative records with stable media/copy fingerprints. Public TikTok data is deliberately excluded from blended CPA/ROAS and budget allocation.

Available seams:

- `GET /api/connectors`: honest readiness contracts for Meta, TikTok public intelligence, Google Ads, YouTube Analytics, GA4 attribution, and LinkedIn Ads.
- `GET/POST /api/readiness`: machine-readable completion status for all 20 production-only gates plus token-authenticated, traceable evidence recording.
- `GET /api/tiktok/acceptance`: consolidated live evidence for the five measurable TikTok Ad Library gates.
- `POST /api/intelligence/summary`: canonical rows, platform summaries, quality gates, source-boundary warnings, and OAuth-authorized GA4 data-driven attribution with truthful last-click fallback.
- `POST /api/connectors/ga4/attribution`: verify the GA4 property reporting model and load attributed key events/revenue by default channel group for a requested date window; interactive reads require the connected Google browser session.
- `POST /api/intelligence/sync`: incremental or full Google Ads, YouTube Analytics, and LinkedIn sync with encrypted OAuth-cookie refresh support. Interactive fetches and caller-supplied row ingestion require the matching connector session.
- Trusted Meta Graph thumbnails, provider-fetched TikTok media, and scheduled connector creatives stream accessible HTTPS media through bounded SHA-256 hashing, relink performance rows to the content identity, and fall back to explicitly labeled metadata fingerprints when media is unavailable, capped, or exceeds limits. Provider-supplied TikTok SHA-256 values are preserved; interactive TikTok media hashing uses its own smaller latency cap. Meta report evidence states that transformed thumbnail renditions only match when their returned bytes are identical. Caller-supplied rows are never fetched for hashing.
- `POST /api/intelligence/backfill`: plan or execute a one-click 13-month monthly backfill for Google Ads, YouTube Analytics, or LinkedIn. Planning is anonymous; execution requires the matching connector session.
- `GET/POST /api/intelligence/incrementality`: atomically persist geo-lift or PSA study results and overlay the latest study.
- `GET /api/intelligence/health`: pipeline row counts, deduplication, latest job, and four-hour SLA status.
- `POST /api/experiments/plan`: hypothesis, MDE, confidence, power, allocation, and sample-size planning.
- `POST /api/experiments/assign`, `/api/experiments/results`, and `/api/experiments/log`: deterministic user/geo assignment, mSPRT/result evaluation, and searchable learnings.
- `POST /api/budget/allocate`: constrained marginal-ROAS allocation and what-if scenarios.
- `POST /api/budget/pacing`, `/api/budget/alerts`, `/api/budget/caps`, `/api/budget/daypart`, and `/api/budget/apply`: pacing assessment, authenticated alerts to server-configured webhooks, guarded cap/daypart/budget actions, and immutable audit records.
- `GET /api/cron/budget-actions/resume`: every 15 minutes, inspects deferred Meta and Google campaign learning states and retries budget writes after learning exits. Meta uses the system-user token; Google uses the scheduled server connector token. Transient provider failures remain deferred for the next attempt.
- `/api/cron/connectors/daily`, `/api/cron/connectors/weekly`, and `/api/cron/budget-models/daily`: refresh-token-capable connector sync and daily Bayesian hierarchical response-curve refresh. The model uses campaign-level normal-normal posteriors over daily log-ROAS and exposes shrinkage diagnostics. Production cron requests fail closed without `CRON_SECRET`.
- `POST /api/cron/connectors/backfill`: cron-authenticated server-token backfills for external orchestrators.
- `orchestration/airflow/dags/decision_workspace_connectors.py`: deployable daily, weekly, and manual backfill DAGs with retry-safe idempotent windows and a four-hour timeout.
- `/api/cron/budget-alerts/daily`: sums current-month owned spend from the canonical pipeline, projects end-of-month spend, and delivers Slack/email alerts when the deviation exceeds 10%. Set `BUDGET_ALERT_TOTAL_BUDGET` to enable it.
- `POST /api/creatives/analyze` and `GET /api/creatives/clusters`: provider-backed multimodal inference with explicit heuristic provenance when the provider is absent.
- `lib/prompt-library.ts`: versioned prompt records for copy, briefs, narration, anomaly detection, and forecasting.

Google Ads, YouTube Analytics, GA4, and LinkedIn remain `needs_setup` until their OAuth credentials, property/account identifiers, and scopes are configured; readiness must not be confused with a live sync.

Acceptance boundaries that require deployed systems or client evidence:

- TikTok CCL coverage of at least 95%, sub-15-minute ingestion, greater than 99% labeled deduplication F1, and sub-two-second search over 10,000+ records must be validated against the approved production feed and production telemetry. The product records a result as acceptance evidence only when a dedicated operator token certifies the cohort in an environment explicitly labeled `production`.
- The 08:00 digest requires the deployed cron schedule, `CRON_SECRET`, `TIKTOK_DIGEST_TIMEZONE`, and at least one Slack/email webhook. The default Vercel schedule is 01:00 UTC for an 08:00 Asia/Ho_Chi_Minh delivery; changing the timezone also requires aligning the UTC cron schedule.
- Creative-score correlation above `|r| > 0.6` requires a real client score-to-CPA cohort covering the requested 30-day validation window; `/api/tiktok/scoring/validate` reports the measured gate without fabricating samples.
- Google Ads, YouTube Analytics, GA4, and LinkedIn require approved OAuth applications, reporting scopes, account/property identifiers, and production refresh tokens before live acceptance can be claimed. GA4 data-driven attribution also verifies that the property reporting model is data-driven before using Data API totals.
- Provider-backed CLIP/video embeddings, object detection, and raw-audio classification require `CREATIVE_INFERENCE_URL`; otherwise every result is explicitly labeled as a deterministic heuristic or fallback.
- Live Meta budget, cap, and daypart writes require a production Meta token with campaign-management permissions. Interactive Google budget, pacing, cap, and campaign daypart writes require the owned Google browser OAuth session plus the Ads developer token; server access tokens are restricted to CRON_SECRET-protected scheduled/internal jobs. TikTok remains recommendation-only until an approved owned-account Ads API connector is available.
- The repository provides idempotent sync/backfill jobs and Vercel cron scheduling. Selecting and operating Airflow, Dagster, or Temporal for a multi-worker production deployment remains infrastructure work.
- X Ads, Pinterest, Snapchat, Reddit, DV360, and The Trade Desk are honest `needs_setup` backlog contracts, not implemented live connectors.

## Module Ownership

- `app/page.tsx`: single-page entry. Renders `DashboardShell`.
- `app/layout.tsx`: root metadata, Geist font, tooltip provider, global CSS.
- `components/dashboard-shell.tsx`: app state machine, form controls, API calls, charts, tables, AI panels, competitor panel, print export trigger.
- `components/ui/*`: shadcn/base-nova UI primitives. Keep reusable, low-domain.
- `app/api/session/route.ts`: token validation, cookie set/clear, auth check.
- `app/api/meta/*/route.ts`: authenticated Meta data endpoints.
- `app/api/ai/*/route.ts`: AI JSON generation endpoints.
- `app/api/spy/meta/route.ts`: competitor ad fetch endpoint.
- `app/api/tiktok/*/route.ts`: TikTok profile and public Ad Library fetch endpoints.
- `lib/types.ts`: shared contracts between API and UI. Update this first when payload shape changes.
- `lib/session.ts`: encrypted HttpOnly Meta token session.
- `lib/meta.ts`: Graph API client, pagination, account/campaign/insight fetch, `DashboardReport` assembly.
- `lib/metrics.ts`: row normalization, KPI pack detection, health scoring, formatting, AI prompt builders, comparison deltas.
- `lib/ai.ts`: 9router gateway calls, retry/fallback logic, strict JSON parsing.
- `lib/competitor-spy.ts`: Apify/Meta official ad fetch + ad normalization.
- `lib/apify.ts`: shared Apify actor runner.
- `lib/tiktok.ts`: TikTok Apify input building and output normalization.
- `lib/utils.ts`: `cn()` helper for class merge.
- `app/globals.css`: Tailwind v4 tokens, theme vars, print rules.

## Environment

Create `.env.local` from `.env.example`.

Required:

```bash
SESSION_SECRET=
```

Useful:

```bash
META_GRAPH_VERSION=v22.0
META_APP_ID=
META_APP_SECRET=
META_LOGIN_CONFIG_ID=
META_OAUTH_REDIRECT_URI=
META_SYSTEM_ACCESS_TOKEN=
OPENROUTER_URL=https://openrouter.ai/api
OPENROUTER_API_KEY=
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_TIMEOUT_MS=90000
OPENROUTER_MAX_TOKENS=2400
OPENROUTER_APP_NAME=Decision Workspace
NINEROUTER_URL=http://localhost:20128
NINEROUTER_KEY=
NINEROUTER_MODEL=mhyc
NINEROUTER_TIMEOUT_MS=45000
NINEROUTER_MAX_TOKENS=1800
META_PUBLIC_SCRAPE_TIMEOUT_MS=45000
META_PUBLIC_SCRAPE_WAIT_MS=12000
APIFY_TOKEN=
APIFY_META_ADS_ACTOR_ID=
APIFY_META_ADS_INPUT_TEMPLATE=
APIFY_TIKTOK_PROFILE_ACTOR_ID=clockworks/tiktok-profile-scraper
APIFY_TIKTOK_ADS_ACTOR_ID=brilliant_gum/tiktok-ads-library-scraper
APIFY_TIKTOK_PROFILE_INPUT_TEMPLATE=
APIFY_TIKTOK_ADS_INPUT_TEMPLATE=
# Optional approved TikTok Commercial Content Library or partner feed; takes precedence over Apify when both are set.
TIKTOK_CCL_API_URL=
TIKTOK_CCL_ACCESS_TOKEN=
TIKTOK_DIGEST_REGION=VN
# Used to report the real local delivery hour; align the UTC cron schedule with this timezone.
TIKTOK_DIGEST_TIMEZONE=Asia/Ho_Chi_Minh
TIKTOK_DIGEST_SLACK_WEBHOOK=
TIKTOK_DIGEST_EMAIL_WEBHOOK=
SLACK_WEBHOOK_URL=
EMAIL_WEBHOOK_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v25
GOOGLE_ADS_ACCESS_TOKEN=
YOUTUBE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=
YOUTUBE_CHANNEL_ID=
GA4_PROPERTY_ID=
GA4_ACCESS_TOKEN=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_AD_ACCOUNT_ID=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_REFRESH_TOKEN=
LINKEDIN_API_VERSION=202607
CONNECTOR_MEDIA_HASH_MAX_ASSETS=250
CONNECTOR_MEDIA_HASH_MAX_BYTES=10485760
CONNECTOR_MEDIA_HASH_TIMEOUT_MS=15000
CRON_SECRET=
DECISION_WORKSPACE_ENVIRONMENT=local
DECISION_WORKSPACE_SCHEDULER=
DECISION_WORKSPACE_PERSISTENCE_MODE=
DECISION_WORKSPACE_DATA_DIR=
DECISION_WORKSPACE_ACCEPTANCE_TOKEN=
DECISION_WORKSPACE_ACCEPTANCE_ENVIRONMENT=local
DECISION_WORKSPACE_ACCEPTANCE_PATH=
BUDGET_ALERT_TOTAL_BUDGET=
BUDGET_ALERT_ACCOUNT=owned account
BUDGET_ALERT_CURRENCY=USD
BUDGET_ALERT_CURVE=linear
BUDGET_ALERT_SLACK_WEBHOOK=
BUDGET_ALERT_EMAIL_WEBHOOK=
CREATIVE_ASSET_STORAGE_DIR=
TIKTOK_WATCHLIST_PATH=
ACTION_AUDIT_PATH=
PIPELINE_STORE_PATH=
INCREMENTALITY_PATH=
BUDGET_MODEL_PATH=
PROMPT_LIBRARY_PATH=
EXPERIMENT_LOG_PATH=
EXPERIMENT_ASSIGNMENT_PATH=
CREATIVE_INFERENCE_URL=
CREATIVE_INFERENCE_API_KEY=
CREATIVE_EMBEDDING_MODEL=clip
CREATIVE_INFERENCE_MAX_BYTES=10485760
```

Facebook Login uses a Meta Facebook Login for Business configuration. Set `META_LOGIN_CONFIG_ID` to that configuration ID and grant `ads_read`, `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts` in the configuration. The valid OAuth redirect URI must exactly match `META_OAUTH_REDIRECT_URI` or `/api/auth/facebook/callback` on the current origin.

No 9router key means Verdict and Insights still return local rule-based output. No Apify vars means competitor fetch uses public no-key scraping and keeps Meta Ad Library links as fallback evidence. TikTok endpoints require `APIFY_TOKEN`; actor IDs are optional overrides because the app ships validated defaults. Set `TIKTOK_CCL_API_URL` and `TIKTOK_CCL_ACCESS_TOKEN` to use an approved CCL/partner feed before Apify.

Google Ads, YouTube Analytics, GA4, and LinkedIn interactive routes require browser OAuth when the client credentials are configured. OAuth access and refresh tokens are encrypted in HttpOnly cookies; interactive routes never fall back to server-side tokens. Scheduled/internal jobs run behind `CRON_SECRET` and prefer `GOOGLE_REFRESH_TOKEN` or `LINKEDIN_REFRESH_TOKEN`, refreshing and briefly caching access tokens at runtime; directly managed access-token variables remain supported when an external secret manager rotates them. The connector workspace exposes incremental sync, full refresh, and an executable 13-month backfill; `execute: false` on the backfill route remains a plan-only preflight. Interactive pacing alerts require the authenticated Meta workspace session and deliver only to webhooks configured in the server environment.

Decision Workspace persistence defaults to local `.data/*.json` stores. In production, set `DECISION_WORKSPACE_PERSISTENCE_MODE=persistent_volume` and point the absolute `DECISION_WORKSPACE_DATA_DIR` at a mounted volume; every default pipeline, evidence, audit, experiment, prompt, watchlist, and creative-asset store then resolves beneath that root. Database and object-storage declarations are not accepted until a real adapter exists. The included `compose.yaml` mounts this root, while `orchestration/airflow/dags/decision_workspace_connectors.py` supplies the required Airflow schedules. Creative inference sends raw media only when it is within `CREATIVE_INFERENCE_MAX_BYTES`; larger files use the labeled text/metadata fallback. Configure `CREATIVE_INFERENCE_URL` for provider-backed embeddings, element tagging, and audio classification. Successful production GA4, provider-inference, and pacing-alert calls record acceptance evidence automatically.

## Dev Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run lint
```

Notes:

- `npm run lint` calls `next lint`; verify Next 15 still supports it in current setup before relying on it in CI.
- App uses Next 15, React 19, Tailwind v4, shadcn/base-nova, Recharts, Lucide icons, Zod.

## Change Guide

### Add Metric

1. Add field to `NormalizedRow` in `lib/types.ts`.
2. Fill field in `normalizeRows()` or `sumRows()` in `lib/metrics.ts`.
3. Add label/format in `getKpiCards()` or table/chart helpers in `components/dashboard-shell.tsx`.
4. Include metric in `buildPrompt()`, `buildInsightPrompt()`, or `comparisonDeltas()` if AI should see it.

### Add KPI Pack

1. Extend `KpiPack` in `lib/types.ts`.
2. Update `packSchema` in `app/api/meta/report/route.ts`.
3. Add option in `packItems` in `components/dashboard-shell.tsx`.
4. Add detection branch in `detectKpiPack()`.
5. Add cards in `getKpiCards()`.

### Add Meta Breakdown

1. Add `getInsights()` call in `buildReport()`.
2. Normalize rows with `normalizeRows(..., "breakdown")`.
3. Add field to `DashboardReport`.
4. Render in `components/dashboard-shell.tsx`.
5. Add prompt payload if AI needs it.

### Add AI Provider

1. Add provider value to UI `providerItems`.
2. Extend route schemas in `app/api/ai/*/route.ts`.
3. Add provider branch in `lib/ai.ts`.
4. Return same local JSON shapes: `Verdict` / temporary `AiVerdict` alias, `AiInsightTable`, `CompetitorSpyResult`.

### Add Competitor Source

1. Extend `CompetitorFetchSource` in `lib/types.ts`.
2. Update `bodySchema` in `app/api/spy/meta/route.ts`.
3. Add source selector item in `components/dashboard-shell.tsx`.
4. Add fetch branch in `fetchCompetitorAds()`.
5. Normalize into `CompetitorSpyAd`; do not leak source-specific shape to UI.

## Guardrails

- Keep API routes thin. Put business rules in `lib/*`.
- Keep `DashboardReport` as server-to-client contract. Avoid ad hoc response shapes.
- Do not send Meta token to client after session creation. Use `requireToken()` server-side.
- Do not invent revenue, CRM, CAPI, MER, Pixel data, TikTok Ads Manager metrics, or conversion data in prompts/fallbacks.
- Keep Verdict reliable first. Local Verdict must work without provider keys; providers enhance or explicitly override only through guarded JSON.
- Keep AI output strict JSON. Parse and fallback instead of rendering raw model text.
- Keep the single global language toggle as the source for interface/report language. Do not add per-panel language selectors.
- Keep competitor output original. Use competitor ads for patterns, not copied claims/copy/visual designs.
- Keep TikTok Ad Library rows separate from owned Meta report data unless a verified owned TikTok Ads Manager source is added.
- Keep print export intact: preserve `data-print-*` attrs and print CSS.
- When changing UI, check desktop/mobile and print layout. `dashboard-shell.tsx` is dense; text overflow can break reports.
