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
    expect(report.dailyRows).toHaveLength(14);
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
});
