import { describe, expect, it } from "vitest";
import { buildSampleReport, SAMPLE_CAMPAIGNS } from "../sample-report";
import { buildLocalVerdict } from "../verdict-rules";
import { runDiagnostics } from "../diagnosis";

describe("buildSampleReport", () => {
  const report = buildSampleReport();

  it("is arithmetically coherent from ads up to account totals", () => {
    expect(report.adRows).toHaveLength(8);
    expect(report.adsetRows).toHaveLength(6);
    expect(report.campaignRows).toHaveLength(3);
    const campaignSpend = report.campaignRows.reduce((sum, row) => sum + row.spend, 0);
    const adSpend = report.adRows.reduce((sum, row) => sum + row.spend, 0);
    expect(campaignSpend).toBe(adSpend);
    expect(report.totals.spend).toBe(campaignSpend);
    const facialCombo = report.campaignRows.find((row) => row.id === "smp-c1");
    expect(facialCombo?.leads).toBe(52);
    expect(facialCombo?.spend).toBe(18_500_000);
  });

  it("detects a lead-driven pack and carries a full report surface", () => {
    expect(report.source).toBe("sample");
    expect(report.detectedPack).toBe(report.selectedPack);
    expect(report.kpis.length).toBeGreaterThan(0);
    expect(report.dailyRows).toHaveLength(30);
    expect(report.platformRows.length).toBeGreaterThan(0);
    expect(report.ageGenderRows.length).toBeGreaterThan(0);
    expect(report.regionRows.length).toBeGreaterThan(0);
    expect(report.health.checks.length).toBeGreaterThan(0);
    expect(report.prompt).toContain("Input JSON:");
    expect(report.selectedCampaigns).toEqual(SAMPLE_CAMPAIGNS);
  });

  it("feeds the local Verdict and the Diagnosis Engine without errors", () => {
    const verdict = buildLocalVerdict(report, "en");
    expect(["low", "medium", "high"]).toContain(verdict.confidence);
    expect(verdict.verdict.length).toBeGreaterThan(0);
    const diagnostics = runDiagnostics(report);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every((diagnostic) => ["ok", "watch", "risk", "insufficient"].includes(diagnostic.severity))).toBe(true);
  });

  it("rebuilds the sample report for campaign, KPI pack, and date-range scope", () => {
    const scoped = buildSampleReport({
      selectedCampaignIds: ["smp-c2"],
      pack: "traffic",
      dateRange: { since: "2026-07-24", until: "2026-07-30" },
    });

    expect(scoped.selectedCampaigns.map((campaign) => campaign.id)).toEqual(["smp-c2"]);
    expect(scoped.campaignRows.map((row) => row.id)).toEqual(["smp-c2"]);
    expect(scoped.selectedPack).toBe("traffic");
    expect(scoped.dailyRows).toHaveLength(7);
    expect(scoped.dateRange).toEqual({ since: "2026-07-24", until: "2026-07-30" });
    expect(scoped.totals.spend).toBeLessThan(buildSampleReport({ selectedCampaignIds: ["smp-c2"] }).totals.spend);
  });

  it("keeps tracked and missing outcome events distinct", () => {
    const lead = buildSampleReport({ selectedCampaignIds: ["smp-c2"] });
    const messages = buildSampleReport({ selectedCampaignIds: ["smp-c3"] });

    expect(lead.totals.metricAvailability).toMatchObject({ leads: "tracked", messages: "not_tracked", purchases: "not_tracked" });
    expect(messages.totals.metricAvailability).toMatchObject({ messages: "tracked", replies: "tracked", leads: "tracked" });
  });

  it("models previous-period sample data instead of fabricating a zero delta", () => {
    const current = buildSampleReport({ dateRange: { since: "2026-07-01", until: "2026-07-30" } });
    const previous = buildSampleReport({ dateRange: { since: "2026-06-01", until: "2026-06-30" } });

    expect(current.totals.spend).not.toBe(previous.totals.spend);
    expect(current.totals.linkClicks).not.toBe(previous.totals.linkClicks);
  });
});
