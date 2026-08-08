import { describe, expect, it } from "vitest";
import {
  buildDashboardReportKey,
  buildMetaReportUrl,
  buildReportRequestKey,
  currentReportScope,
  reportCampaignSelectionForAccount,
  toggleReportCampaignSelection,
} from "../report-refresh";
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

  it("treats campaign order as the same active request", () => {
    const base = {
      accountId: "act_1",
      since: "2026-07-01",
      until: "2026-07-31",
      pack: "sales_roas" as const,
      compareMode: "previous" as const,
    };

    expect(buildReportRequestKey({ ...base, selectedCampaignIds: ["campaign-b", "campaign-a"] }))
      .toBe(buildReportRequestKey({ ...base, selectedCampaignIds: ["campaign-a", "campaign-b"] }));
  });

  it("changes report identity when refreshed data or campaign scope changes", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1"] });
    const refreshed = { ...report, pulledAt: "2026-08-08T12:00:00.000Z" };
    const otherCampaign = buildSampleReport({ selectedCampaignIds: ["smp-c2"] });

    expect(buildDashboardReportKey(refreshed)).not.toBe(buildDashboardReportKey(report));
    expect(buildDashboardReportKey(otherCampaign)).not.toBe(buildDashboardReportKey(report));
  });

  it("deselects one campaign from the implicit all-active scope", () => {
    expect(toggleReportCampaignSelection({
      selectedIds: [],
      activeCampaignIds: ["campaign-a", "campaign-b", "campaign-c"],
      campaignId: "campaign-b",
    })).toEqual(["campaign-a", "campaign-c"]);
  });

  it("adds an inactive campaign without dropping the implicit active scope", () => {
    expect(toggleReportCampaignSelection({
      selectedIds: [],
      activeCampaignIds: ["campaign-a", "campaign-b"],
      campaignId: "campaign-paused",
    })).toEqual(["campaign-a", "campaign-b", "campaign-paused"]);
  });

  it("keeps one explicit campaign selected because an empty scope means all active", () => {
    expect(toggleReportCampaignSelection({
      selectedIds: ["campaign-a"],
      activeCampaignIds: ["campaign-a", "campaign-b"],
      campaignId: "campaign-a",
    })).toEqual(["campaign-a"]);
  });
});
