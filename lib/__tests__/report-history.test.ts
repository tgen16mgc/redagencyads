import { describe, expect, it } from "vitest";
import { buildSampleReport } from "../sample-report";
import { normalizeSavedReportCopy, reportSnapshotKey, restoreSavedReportExecutionScope } from "../report-history";
import type { ReportExecutionScope } from "../report-refresh";

describe("normalizeSavedReportCopy", () => {
  it("upgrades legacy M25 copy when restoring a saved report", () => {
    const report = buildSampleReport();
    const legacyReport = {
      ...report,
      health: {
        ...report.health,
        checks: report.health.checks.map((check) => check.id === "M25"
          ? {
              ...check,
              label: "Creative/ad volume proxy",
              detail: "8 ads found in selected scope. Target: 10+ diverse creatives where budget supports it.",
            }
          : check),
      },
    };

    const normalized = normalizeSavedReportCopy(legacyReport);
    const creativeCoverage = normalized.health.checks.find((check) => check.id === "M25");

    expect(creativeCoverage).toMatchObject({
      label: "Creative coverage",
      detail: "Only 8 ads are active in this scope. Add more distinct creative concepts before scaling; aim for at least 10 when budget allows.",
    });
    expect(legacyReport.health.checks.find((check) => check.id === "M25")?.label).toBe("Creative/ad volume proxy");
  });
});

describe("saved report execution scope", () => {
  const executionScope: ReportExecutionScope = {
    accountId: "act_sample_demo",
    selectedCampaignIds: ["smp-c1"],
    since: "2026-09-01",
    until: "2026-09-05",
    pack: "sales_roas",
    compareMode: "campaign",
    comparisonCampaignIds: ["smp-c2"],
    comparisonSince: "2026-07-01",
    comparisonUntil: "2026-07-31",
    targetCpa: "40",
    targetRoas: "2.5",
  };

  it("keeps same-period reports for different campaign scopes distinct", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1"], pack: "sales_roas", dateRange: { since: executionScope.since, until: executionScope.until } });

    expect(reportSnapshotKey(report, executionScope))
      .not.toBe(reportSnapshotKey(report, { ...executionScope, selectedCampaignIds: ["smp-c2"] }));
    expect(reportSnapshotKey(report, executionScope))
      .not.toBe(reportSnapshotKey(report, { ...executionScope, comparisonSince: "2026-06-01", comparisonUntil: "2026-06-30" }));
  });

  it("derives the real campaign comparison from a legacy snapshot", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1"], pack: "sales_roas", dateRange: { since: executionScope.since, until: executionScope.until } });
    const previousReport = buildSampleReport({ selectedCampaignIds: ["smp-c2"], pack: "sales_roas", dateRange: { since: executionScope.comparisonSince, until: executionScope.comparisonUntil } });

    expect(restoreSavedReportExecutionScope({ report, previousReport, executionScope: null })).toEqual({
      ...executionScope,
      targetCpa: "",
      targetRoas: "",
    });
  });
});
