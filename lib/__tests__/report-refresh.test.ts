import { describe, expect, it } from "vitest";
import { currentReportScope, reportCampaignSelectionForAccount } from "../report-refresh";
import { buildSampleReport } from "../sample-report";

describe("current report refresh scope", () => {
  it("uses the report scope instead of mutable scope controls", () => {
    const report = buildSampleReport({
      selectedCampaignIds: ["smp-c1"],
      pack: "sales_roas",
      dateRange: { since: "2026-07-01", until: "2026-07-31" },
    });

    expect(currentReportScope(report)).toEqual({
      selectedCampaignIds: ["smp-c1"],
      since: "2026-07-01",
      until: "2026-07-31",
      pack: "sales_roas",
    });
  });

  it("preserves report campaigns when campaign metadata reloads for the same account", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1"] });

    expect(reportCampaignSelectionForAccount(report.account.id, report)).toEqual(["smp-c1"]);
    expect(reportCampaignSelectionForAccount("act_different", report)).toEqual([]);
  });
});
