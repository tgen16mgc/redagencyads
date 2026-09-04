# Report scope overhaul TDD evidence

## Source plan

Journeys and acceptance criteria were derived in the ECC planning pass for this task; no separate `*.plan.md` file was supplied.

## User journeys

- As an analyst, I can edit one understandable report scope and see exactly what will refresh before applying it.
- As an analyst viewing a saved or live report, every Refresh action reloads that report's exact account, campaigns, dates, comparison, KPI pack, and targets.
- As an analyst launching a new campaign, I can compare it with an older campaign over an independent historical period.
- As a returning analyst, restoring a saved report restores its execution scope; legacy snapshots derive a safe scope from their reports.

## RED and GREEN

| Stage | Evidence |
|---|---|
| RED | `npm test -- lib/__tests__/report-refresh.test.ts lib/__tests__/report-history.test.ts app/api/workspace/reports/route.test.ts` produced 8 expected failures for immutable refresh scope, campaign freezing, comparison identity, persistence, retry scope, and legacy restoration. |
| RED checkpoint | `acfb6e0 test: lock report refresh scope behavior` is reachable from `main`. |
| GREEN target | The same target passes 33 tests across unit and API integration coverage. |
| GREEN full suite | `npm test` passes 157 files and 1,021 tests. |
| Browser | `node scripts/report-scope-regression.mjs` passes desktop and mobile modal bounds, draft isolation, cancel behavior, and both refresh entry points. |
| Build | `npm run build` completes the Next.js production build successfully. |

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|---|---|---|---|
| 1 | All-active is resolved to exact campaign IDs before execution. | `lib/__tests__/report-refresh.test.ts` | Unit | PASS |
| 2 | Refresh scope comes from the visible report and its exact comparison report. | `lib/__tests__/report-refresh.test.ts` | Unit | PASS |
| 3 | Request identity changes when campaigns, comparison period, comparison campaigns, or targets change. | `lib/__tests__/report-refresh.test.ts` | Unit | PASS |
| 4 | Saved reports with the same account and period remain distinct by full execution scope. | `lib/__tests__/report-history.test.ts` | Unit | PASS |
| 5 | Legacy snapshots derive campaign or previous-period comparison from their actual reports. | `lib/__tests__/report-history.test.ts` | Unit | PASS |
| 6 | The reports API persists execution scope with a server-generated SHA-256 scope key. | `app/api/workspace/reports/route.test.ts` | Integration | PASS |
| 7 | Different historical comparison campaigns produce different storage identities. | `app/api/workspace/reports/route.test.ts` | Integration | PASS |
| 8 | Draft editing and cancellation cannot change the report in view. | `scripts/report-scope-regression.mjs` | Browser E2E | PASS |
| 9 | Top-bar and in-report Refresh preserve the report identity on desktop and mobile. | `scripts/report-scope-regression.mjs` | Browser E2E | PASS |

## Coverage

The repository has no committed coverage script/provider, so the compatible provider was installed transiently without changing `package.json` or `package-lock.json`.

```text
npx vitest run lib/__tests__/report-refresh.test.ts lib/__tests__/report-history.test.ts --coverage --coverage.provider=v8 --coverage.include=lib/report-refresh.ts --coverage.include=lib/report-history.ts --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.statements=80 --coverage.thresholds.branches=80

Statements 100% | Branches 92.5% | Functions 100% | Lines 100%
```

API behavior is covered by integration tests and the complete UI lifecycle by the Puppeteer regression. Component line coverage is not collected because this repository does not include a DOM component-test harness.
