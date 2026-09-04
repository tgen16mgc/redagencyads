import { describe, expect, it } from "vitest";
import {
  buildDashboardReportKey,
  buildMetaReportUrl,
  buildReportRequestKey,
  campaignComparisonAvailable,
  currentReportScope,
  finalizeReportExecutionScope,
  preserveRequestedCampaignSelection,
  reportCampaignSelectionsEqual,
  reportCampaignSelectionForAccount,
  reportScopeDraftsEqual,
  resolveReportExecutionScope,
  toggleReportCampaignSelection,
  type ReportExecutionScope,
} from "../report-refresh";
import { buildSampleReport } from "../sample-report";

describe("current report refresh scope", () => {
  it("binds refresh to the visible report and its exact comparison report", () => {
    const report = buildSampleReport({
      selectedCampaignIds: ["smp-c1"],
      pack: "sales_roas",
      dateRange: { since: "2026-09-01", until: "2026-09-05" },
    });
    const comparison = buildSampleReport({
      selectedCampaignIds: ["smp-c2"],
      pack: "sales_roas",
      dateRange: { since: "2026-07-01", until: "2026-07-31" },
    });

    expect(currentReportScope(report, {
      previousReport: comparison,
      compareMode: "campaign",
      targetCpa: "40.00",
      targetRoas: "2.50",
    })).toEqual({
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
    });
  });

  it("expands the all-active shortcut into an exact execution scope", () => {
    const draft: ReportExecutionScope = {
      accountId: "act_1",
      selectedCampaignIds: [],
      since: "2026-09-01",
      until: "2026-09-05",
      pack: "lead_gen",
      compareMode: "previous",
      comparisonCampaignIds: [],
      comparisonSince: "",
      comparisonUntil: "",
      targetCpa: "40.0",
      targetRoas: "",
    };

    expect(resolveReportExecutionScope(draft, [
      { id: "active-b", status: "ACTIVE" },
      { id: "paused", status: "PAUSED" },
      { id: "active-a", effective_status: "ACTIVE" },
    ])).toEqual({
      ...draft,
      selectedCampaignIds: ["active-a", "active-b"],
      comparisonCampaignIds: ["active-a", "active-b"],
      comparisonSince: "2026-08-27",
      comparisonUntil: "2026-08-31",
      targetCpa: "40",
    });
  });

  it("freezes returned campaign ids without widening an explicit report", () => {
    const requested: ReportExecutionScope = {
      accountId: "act_sample_demo",
      selectedCampaignIds: [],
      since: "2026-09-01",
      until: "2026-09-05",
      pack: "auto",
      compareMode: "off",
      comparisonCampaignIds: [],
      comparisonSince: "",
      comparisonUntil: "",
      targetCpa: "",
      targetRoas: "",
    };
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c2"], pack: "traffic", dateRange: { since: requested.since, until: requested.until } });

    expect(finalizeReportExecutionScope(requested, report, null)).toMatchObject({
      selectedCampaignIds: ["smp-c2"],
      pack: "traffic",
      compareMode: "off",
    });
  });

  it("deduplicates only executions with the same comparison and decision rules", () => {
    const base: ReportExecutionScope = {
      accountId: "act_1",
      selectedCampaignIds: ["new-launch"],
      since: "2026-09-01",
      until: "2026-09-05",
      pack: "sales_roas",
      compareMode: "campaign",
      comparisonCampaignIds: ["old-campaign"],
      comparisonSince: "2026-07-01",
      comparisonUntil: "2026-07-31",
      targetCpa: "40",
      targetRoas: "2.5",
    };

    expect(buildReportRequestKey({ ...base, selectedCampaignIds: ["new-launch"] }))
      .not.toBe(buildReportRequestKey({ ...base, comparisonCampaignIds: ["another-control"] }));
    expect(buildReportRequestKey(base))
      .not.toBe(buildReportRequestKey({ ...base, comparisonSince: "2026-06-01", comparisonUntil: "2026-06-30" }));
    expect(buildReportRequestKey(base))
      .not.toBe(buildReportRequestKey({ ...base, targetRoas: "3" }));
  });

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

  it("keeps an implicit all-active refresh implicit", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1", "smp-c2"] });

    expect(currentReportScope(report, []).selectedCampaignIds).toEqual([]);
    expect(preserveRequestedCampaignSelection([], report)).toEqual([]);
    expect(preserveRequestedCampaignSelection(["smp-c1"], report)).toEqual(["smp-c1", "smp-c2"]);
  });

  it("never widens an explicit empty response into implicit all-active", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1"] });
    report.selectedCampaigns = [];

    expect(preserveRequestedCampaignSelection(["missing-campaign"], report)).toEqual(["missing-campaign"]);
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

  it("collapses an explicit copy of all active campaigns back to implicit all-active", () => {
    expect(toggleReportCampaignSelection({
      selectedIds: ["campaign-a"],
      activeCampaignIds: ["campaign-a", "campaign-b"],
      campaignId: "campaign-b",
    })).toEqual([]);
  });

  it("keeps one explicit campaign selected because an empty scope means all active", () => {
    expect(toggleReportCampaignSelection({
      selectedIds: ["campaign-a"],
      activeCampaignIds: ["campaign-a", "campaign-b"],
      campaignId: "campaign-a",
    })).toEqual(["campaign-a"]);
  });

  it("compares campaign scopes without depending on selection order", () => {
    expect(reportCampaignSelectionsEqual(["b", "a"], ["a", "b"])).toBe(true);
    expect(reportCampaignSelectionsEqual([], [])).toBe(true);
    expect(reportCampaignSelectionsEqual(["a"], [])).toBe(false);
  });

  it("compares the complete report draft while normalizing account and numeric formats", () => {
    const base = {
      accountId: "act_123",
      selectedCampaignIds: ["b", "a"],
      since: "2026-07-01",
      until: "2026-07-31",
      pack: "sales_roas" as const,
      compareMode: "previous" as const,
      targetCpa: "40.0",
      targetRoas: "2.50",
    };

    expect(reportScopeDraftsEqual(base, {
      ...base,
      accountId: "123",
      selectedCampaignIds: ["a", "b"],
      targetCpa: "40",
      targetRoas: "2.5",
    })).toBe(true);
    expect(reportScopeDraftsEqual(base, { ...base, compareMode: "off" })).toBe(false);
    expect(reportScopeDraftsEqual(base, { ...base, selectedCampaignIds: [] })).toBe(false);
  });

  it("offers campaign comparison only when an active peer exists outside the explicit scope", () => {
    const campaigns = [
      { id: "a", status: "ACTIVE" },
      { id: "b", effective_status: "ACTIVE" },
      { id: "paused", status: "PAUSED" },
    ];

    expect(campaignComparisonAvailable(campaigns, [])).toBe(false);
    expect(campaignComparisonAvailable(campaigns, ["a"])).toBe(true);
    expect(campaignComparisonAvailable(campaigns, ["a", "b"])).toBe(false);
    expect(campaignComparisonAvailable(campaigns, ["a", "paused"])).toBe(true);
  });
});
