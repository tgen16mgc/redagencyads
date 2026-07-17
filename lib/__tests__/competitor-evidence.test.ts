import { describe, expect, it } from "vitest";
import { acceptedManualEvidenceText, competitorEvidenceReadiness, reviewCompetitorEvidence } from "../competitor-evidence";

describe("reviewCompetitorEvidence", () => {
  it("links manual evidence lines to a named advertiser", () => {
    const rows = reviewCompetitorEvidence(
      "Northstar - UGC video, Send Message CTA - https://www.facebook.com/ads/library/?id=101\nUnclear proof-led offer",
      ["Northstar", "Beacon"],
    );

    expect(rows).toEqual([
      expect.objectContaining({
        advertiser: "Northstar",
        sourceUrl: "https://www.facebook.com/ads/library/?id=101",
        status: "accepted",
      }),
      expect.objectContaining({ advertiser: undefined, status: "needs_review" }),
    ]);
  });

  it("only sends advertiser-and-source-linked lines into analysis", () => {
    expect(
      acceptedManualEvidenceText(
        "Northstar - UGC video - https://www.facebook.com/ads/library/?id=101\nUnknown advertiser - discount - https://www.facebook.com/ads/library/?id=202",
        ["Northstar"],
      ),
    ).toBe("Northstar - UGC video - https://www.facebook.com/ads/library/?id=101");
  });

  it("does not verify advertiser-linked notes without Meta Ad Library provenance", () => {
    const rows = reviewCompetitorEvidence(
      "Northstar - UGC video\nNorthstar - discount - https://example.com/ad/1\nNorthstar - fake path - https://www.facebook.com/ads/library-fake?id=3",
      ["Northstar"],
    );

    expect(rows).toEqual([
      expect.objectContaining({ advertiser: "Northstar", sourceUrl: undefined, status: "needs_review" }),
      expect.objectContaining({ advertiser: "Northstar", sourceUrl: undefined, status: "needs_review" }),
      expect.objectContaining({ advertiser: "Northstar", sourceUrl: undefined, status: "needs_review" }),
    ]);
  });

  it("does not link a competitor name found only as a substring", () => {
    const rows = reviewCompetitorEvidence(
      "UGC campaign with Send Message CTA",
      ["A"],
    );

    expect(rows[0]).toEqual(expect.objectContaining({ advertiser: undefined, status: "needs_review" }));
  });

  it("requires the advertiser to be an explicit line prefix", () => {
    const rows = reviewCompetitorEvidence(
      "Observed Northstar - UGC video - https://www.facebook.com/ads/library/?id=1\nNorthstar: proof-led offer - https://www.facebook.com/ads/library/?id=2\n[Beacon] carousel - https://www.facebook.com/ads/library/?id=3",
      ["Northstar", "Beacon"],
    );

    expect(rows).toEqual([
      expect.objectContaining({ advertiser: undefined, status: "needs_review" }),
      expect.objectContaining({ advertiser: "Northstar", status: "accepted" }),
      expect.objectContaining({ advertiser: "Beacon", status: "accepted" }),
    ]);
  });
});

describe("competitorEvidenceReadiness", () => {
  it("keeps accepted manual evidence analyzable when Apify is unavailable", () => {
    expect(competitorEvidenceReadiness({
      hasCompetitors: true,
      acceptedCount: 1,
      acceptedManualCount: 1,
      collectedCount: 0,
      setupRequired: true,
      collecting: false,
      analyzing: false,
    })).toEqual({ canAnalyze: true, primaryIsCollect: false, dockStatus: "ready" });
  });

  it("blocks collection without Apify when there is no accepted evidence", () => {
    expect(competitorEvidenceReadiness({
      hasCompetitors: true,
      acceptedCount: 0,
      acceptedManualCount: 0,
      collectedCount: 0,
      setupRequired: true,
      collecting: false,
      analyzing: false,
    })).toEqual({ canAnalyze: false, primaryIsCollect: true, dockStatus: "blocked" });
  });

  it("makes an in-flight analysis the active status", () => {
    expect(competitorEvidenceReadiness({
      hasCompetitors: true,
      acceptedCount: 1,
      acceptedManualCount: 1,
      collectedCount: 0,
      setupRequired: true,
      collecting: false,
      analyzing: true,
    }).dockStatus).toBe("working");
  });
});
