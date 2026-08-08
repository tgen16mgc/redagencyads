import { describe, expect, it } from "vitest";
import { buildMetaReportUrl, currentReportScope, reportCampaignSelectionForAccount } from "../report-refresh";
import { buildSampleReport } from "../sample-report";

describe("current report refresh scope", () => {
  it("uses the report scope instead of mutable scope controls", () => {
    const report = buildSampleReport({
      selectedCampaignIds: ["smp-c1"],
      pack: "sales_roas",
      dateRange: { since: "2026-07-01", until: "2026-07-31" },
    });

    expect(currentReportScope(report)).toEqual({
      accountId: "act_sample_demo",
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

  it("treats prefixed and unprefixed Meta account ids as the same account", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c2"] });
    report.account = { ...report.account, id: "act_123", account_id: "123" };

    expect(reportCampaignSelectionForAccount("123", report)).toEqual(["smp-c2"]);
  });

  it("builds a refresh request for only the campaign loaded in the current report", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c2"] });
    const url = new URL(buildMetaReportUrl("https://workspace.test", currentReportScope(report)));

    expect(url.searchParams.get("accountId")).toBe(report.account.id);
    expect(url.searchParams.getAll("campaignId")).toEqual(["smp-c2"]);
    expect(url.searchParams.get("pack")).toBe(report.selectedPack);
  });
});
