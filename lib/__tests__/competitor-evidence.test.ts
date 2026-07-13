import { describe, expect, it } from "vitest";
import { advertiserLinkedEvidenceText, reviewCompetitorEvidence } from "../competitor-evidence";

describe("reviewCompetitorEvidence", () => {
  it("links manual evidence lines to a named advertiser", () => {
    const rows = reviewCompetitorEvidence(
      "Northstar - UGC video, Send Message CTA\nUnclear proof-led offer",
      ["Northstar", "Beacon"],
    );

    expect(rows).toEqual([
      expect.objectContaining({ advertiser: "Northstar", status: "advertiser_linked" }),
      expect.objectContaining({ advertiser: undefined, status: "needs_review" }),
    ]);
  });

  it("only sends advertiser-linked lines into analysis", () => {
    expect(
      advertiserLinkedEvidenceText(
        "Northstar - UGC video\nUnknown advertiser - discount",
        ["Northstar"],
      ),
    ).toBe("Northstar - UGC video");
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
      "Observed Northstar - UGC video\nNorthstar: proof-led offer\n[Beacon] carousel",
      ["Northstar", "Beacon"],
    );

    expect(rows).toEqual([
      expect.objectContaining({ advertiser: undefined, status: "needs_review" }),
      expect.objectContaining({ advertiser: "Northstar", status: "advertiser_linked" }),
      expect.objectContaining({ advertiser: "Beacon", status: "advertiser_linked" }),
    ]);
  });
});
