import { describe, expect, it } from "vitest";
import { buildSampleReport } from "../sample-report";
import { normalizeSavedReportCopy } from "../report-history";

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
