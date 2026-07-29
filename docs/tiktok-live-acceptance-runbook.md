# TikTok Live Acceptance Runbook

This runbook certifies the five measurable TikTok Ad Library gates without allowing ordinary product traffic or anonymous synthetic samples to change release status.

## 1. Production Preflight

Configure these values in the deployed Decision Workspace:

```bash
TIKTOK_ACCEPTANCE_PATH=/persistent/path/tiktok-acceptance.json
TIKTOK_ACCEPTANCE_TOKEN=<dedicated high-entropy operator token>
TIKTOK_ACCEPTANCE_ENVIRONMENT=production
TIKTOK_CCL_API_URL=<approved CCL or partner endpoint>
TIKTOK_CCL_ACCESS_TOKEN=<approved feed token>
CRON_SECRET=<deployed cron secret>
TIKTOK_DIGEST_TIMEZONE=Asia/Ho_Chi_Minh
TIKTOK_DIGEST_SLACK_WEBHOOK=<optional>
TIKTOK_DIGEST_EMAIL_WEBHOOK=<optional>
```

At least one digest webhook is required. Keep the acceptance token separate from Meta, TikTok, cron, and application-session credentials.

On the operator machine, set only:

```bash
DECISION_WORKSPACE_URL=https://decision-workspace.example
TIKTOK_ACCEPTANCE_TOKEN=<same dedicated operator token>
```

Do not commit tokens or cohort files containing confidential client metrics.

## 2. Measurement Versus Certification

All validation routes calculate and return results without a token. Anonymous calls return:

```json
{
  "evidenceRecording": {
    "recorded": false,
    "reason": "not_requested"
  }
}
```

Only `--record` sends the operator token. A certified record includes:

- certification timestamp;
- server-side certification environment;
- caller-supplied cohort label;
- request origin;
- `operator_token` certification method.

The status endpoint passes a gate only when its required evidence is certified with `environment: "production"`. A locally calculated pass cannot make production readiness green.

## 3. Cohort Contracts

### T1.1.1 Advertiser Coverage

```json
{
  "region": "DE",
  "handles": ["advertiser-one", "advertiser-two"]
}
```

Use a representative, versioned handle cohort. The gate additionally verifies that every result came from the approved CCL or partner feed, not the public fallback.

### T1.1.2 Ingestion Timing

```json
{
  "region": "DE",
  "queryType": "1",
  "query": "advertiser-one",
  "maxAds": 500,
  "fetchDetails": true
}
```

Run against the approved production feed. This certifies raw-to-normalized timing only; labeled deduplication is a separate cohort.

### T1.1.2 Labeled Deduplication

```json
{
  "samples": [
    {
      "expectedCreativeId": "creative-a",
      "row": { "materialId": "source-a-1", "videoUrl": "https://cdn.example/a.mp4" }
    },
    {
      "expectedCreativeId": "creative-a",
      "row": { "materialId": "source-a-2", "videoUrl": "https://cdn.example/a.mp4?token=2" }
    }
  ]
}
```

Labels must be established independently of the product's identity rules. The gate uses duplicate-pair precision, recall, and F1 and requires F1 above `0.99`.

### T1.1.3 Search Benchmark

```json
{
  "rows": [
    { "id": "creative-1", "advertiserName": "Brand", "caption": "launch", "format": "video" }
  ],
  "filters": { "keyword": "launch", "performanceTier": "top" }
}
```

Use an exported production-shaped catalog. Do not certify the tiny illustrative object above; it documents the envelope only.

### T1.1.5 Score-To-CPA Correlation

```json
{
  "samples": [
    { "score": 20, "cpa": 100, "observedAt": "2026-07-01T00:00:00.000Z" },
    { "score": 50, "cpa": 70, "observedAt": "2026-07-15T00:00:00.000Z" },
    { "score": 80, "cpa": 40, "observedAt": "2026-07-30T00:00:00.000Z" }
  ]
}
```

Supply at least three observations, a valid timestamp on every observation, and an inclusive window of at least 30 days. The route requires `|r| > 0.6`.

## 4. Certification Commands

Run each cohort once without `--record`, inspect the result, then certify the unchanged file:

```bash
node scripts/tiktok-acceptance.mjs coverage coverage.json --require-pass
node scripts/tiktok-acceptance.mjs coverage coverage.json --record --cohort advertiser-coverage-2026-07-29 --require-pass

node scripts/tiktok-acceptance.mjs ingestion ingestion.json --record --cohort approved-feed-2026-07-29 --require-pass
node scripts/tiktok-acceptance.mjs deduplication deduplication.json --record --cohort labeled-dedup-2026-07-29 --require-pass
node scripts/tiktok-acceptance.mjs search search.json --record --cohort production-search-2026-07-29 --require-pass
node scripts/tiktok-acceptance.mjs scoring score-cpa.json --record --cohort client-cpa-2026-07-29 --require-pass
```

The digest gate is certified by the cron route only after at least one configured webhook succeeds at or before 08:00 local time.

## 5. Release Verification

```bash
node scripts/tiktok-acceptance.mjs status --require-pass
```

Also verify the TikTok workspace card shows `5/5 gates proven`. Preserve the evidence JSON and source cohort versions with the release record. Rotate the acceptance token after exposure or operator turnover; rotating it does not invalidate already stored evidence.
