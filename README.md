# Red Agency Ads Tool

Next.js dashboard for campaign-first Meta Ads analysis, deterministic Verdicts, optional AI enhancement, PDF export, bilingual UI, and competitor ad-library spy work.

## Product Map

User sees one app with two work areas:

- `Ads analysis`: connect Meta token, choose ad account, choose campaign scope, pull Meta insights, inspect KPI cards/charts/tables, generate Verdict + insight table, export print/PDF report.
- `Competitor spy`: enter competitor names or Meta Ad Library URLs, fetch competitor ads via Apify or Meta official API, generate competitive readout + original test briefs.
- `TikTok intelligence`: fetch TikTok profile/video metadata and public TikTok Ad Library rows through Apify actors for creative and competitor analysis.
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
- Token is stored in `meta_ads_session` HttpOnly cookie for 12 hours.
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

Competitor side has two phases: fetch ads, then interpret ads.

```text
Fetch ads
  -> POST /api/spy/meta
    -> lib/competitor-spy.fetchCompetitorAds()
      -> public no-key Meta Ad Library scrape with local Chrome
      -> fallback public Meta Ad Library links
      -> Apify actor via APIFY_TOKEN + APIFY_META_ADS_ACTOR_ID
      -> or Meta official ads_archive using session token
      -> normalize into CompetitorSpyAd[]

Generate spy report
  -> POST /api/ai/competitor
    -> lib/metrics.buildCompetitorSpyPrompt()
    -> lib/ai.generateCompetitorSpy()
```

Public scrape is default and works without an API key on a machine with Chrome installed. It attempts to extract public Meta Ad Library payloads, then keeps the library links as fallback evidence when Meta blocks or returns sparse data. Apify remains optional for external commercial scraping. Meta official source needs session token and may return sparse data.

### 6. TikTok Intelligence

TikTok data is fetched through Apify actors and stays separate from the owned Meta report contract.

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
      -> data_xplorer/tiktok-ads-library-fast by default
      -> normalize into TikTokLibraryReport
```

TikTok Ad Library rows are public creative/intelligence data. They may include public ranges such as spend, reach, impressions, audience, targeting, or sponsor fields depending on the actor, but they are not treated as owned TikTok Ads Manager performance.

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
- `public/red-agency-logo.png`: app logo used in token screen and sidebar/header.

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
META_OAUTH_REDIRECT_URI=
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
APIFY_TIKTOK_ADS_ACTOR_ID=data_xplorer/tiktok-ads-library-fast
APIFY_TIKTOK_PROFILE_INPUT_TEMPLATE=
APIFY_TIKTOK_ADS_INPUT_TEMPLATE=
```

No 9router key means Verdict and Insights still return local rule-based output. No Apify vars means competitor fetch uses public no-key scraping and keeps Meta Ad Library links as fallback evidence. TikTok endpoints require `APIFY_TOKEN` plus the selected TikTok actor IDs.

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
