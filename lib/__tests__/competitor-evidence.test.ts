import { describe, expect, it } from "vitest";
import {
  canVerifyCompetitorEvidence,
  competitorInputChangeEffects,
  deriveCompetitorEvidenceModel,
  matchAdvertiserName,
  trustedMetaLibraryUrl,
  type CompetitorInputField,
} from "../competitor-evidence";
import type { CompetitorEvidenceProvenance, CompetitorFetchResult, CompetitorSpyAd } from "../types";

const TRUSTED_URL = "https://www.facebook.com/ads/library/?id=1";

function provenance(overrides: Partial<CompetitorEvidenceProvenance> = {}): CompetitorEvidenceProvenance {
  return {
    status: "accepted",
    match: "exact",
    reason: "exact_advertiser_trusted_source",
    matchedToCompetitor: true,
    hasUsableCreative: true,
    requestedCompetitor: "Northstar",
    advertiser: "Northstar",
    sourceUrl: TRUSTED_URL,
    collectedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function ad(id: string, evidenceOverrides: Partial<CompetitorEvidenceProvenance> = {}): CompetitorSpyAd {
  return { id, source: "apify", evidence: provenance(evidenceOverrides) };
}

function fetchResult(ads: CompetitorSpyAd[]): CompetitorFetchResult {
  return {
    source: "apify",
    outcome: ads.some((item) => item.evidence?.matchedToCompetitor) ? "matched" : "zero_match",
    ads,
    coverage: [],
    warnings: [],
    fetchedAt: "2026-07-01T00:00:00.000Z",
  };
}

function model(overrides: Partial<Parameters<typeof deriveCompetitorEvidenceModel>[0]> = {}) {
  return deriveCompetitorEvidenceModel({
    competitors: ["Northstar"],
    notes: "",
    evidence: null,
    collectionAvailable: true,
    collecting: false,
    analyzing: false,
    ...overrides,
  });
}

describe("trustedMetaLibraryUrl", () => {
  it.each([
    ["https://www.facebook.com/ads/library/?id=1", "https://www.facebook.com/ads/library/?id=1"],
    ["https://m.facebook.com/ads/library/?id=6", "https://m.facebook.com/ads/library/?id=6"],
    ["https://facebook.com/ads/library?id=7", "https://facebook.com/ads/library?id=7"],
    ["https://www.facebook.com/ads/library/?id=9.", "https://www.facebook.com/ads/library/?id=9"],
    ["http://www.facebook.com/ads/library/?id=1", undefined],
    ["https://example.com/ads/library/?id=2", undefined],
    ["https://facebook.com.evil.test/ads/library/?id=3", undefined],
    ["https://www.facebook.com/ads/library-fake?id=4", undefined],
    ["https://www.facebook.com/ads/library/report/?id=5", undefined],
    ["not a url", undefined],
    [undefined, undefined],
  ])("maps %s to %s", (value, expected) => {
    expect(trustedMetaLibraryUrl(value)).toBe(expected);
  });
});

describe("matchAdvertiserName", () => {
  it.each([
    ["Northstar", "Northstar", "exact"],
    ["  Seoul   Spa ", "seoul spa", "exact"],
    ["Seoul Spa Vietnam", "Seoul Spa", "similar"],
    ["Spa", "Seoul Spa", "similar"],
    ["Seoul Spa - Official", "Seoul Spa", "similar"],
    ["Kangnamspa Clinic", "Spa", "none"],
    ["Beacon Ads", "A", "none"],
    ["Unrelated Clinic", "Seoul Spa", "none"],
    ["", "Seoul Spa", "none"],
    [undefined, "Seoul Spa", "none"],
    ["Seoul Spa", "", "none"],
  ])("matches %s against %s as %s", (advertiser, competitor, expected) => {
    expect(matchAdvertiserName(advertiser, competitor)).toBe(expected);
  });
});

describe("manual evidence rows", () => {
  it("accepts lines with an advertiser prefix and a trusted Meta source", () => {
    const rows = model({
      competitors: ["Northstar", "Beacon"],
      notes: "Northstar - UGC video, Send Message CTA - https://www.facebook.com/ads/library/?id=101\nUnclear proof-led offer",
    }).manualRows;

    expect(rows).toEqual([
      expect.objectContaining({
        advertiser: "Northstar",
        sourceUrl: "https://www.facebook.com/ads/library/?id=101",
        status: "accepted",
      }),
      expect.objectContaining({ advertiser: undefined, status: "needs_review" }),
    ]);
  });

  it("does not verify advertiser-linked notes without Meta Ad Library provenance", () => {
    const rows = model({
      notes: "Northstar - UGC video\nNorthstar - discount - https://example.com/ad/1\nNorthstar - fake path - https://www.facebook.com/ads/library-fake?id=3",
    }).manualRows;

    expect(rows).toEqual([
      expect.objectContaining({ advertiser: "Northstar", sourceUrl: undefined, status: "needs_review" }),
      expect.objectContaining({ advertiser: "Northstar", sourceUrl: undefined, status: "needs_review" }),
      expect.objectContaining({ advertiser: "Northstar", sourceUrl: undefined, status: "needs_review" }),
    ]);
  });

  it("requires the advertiser to be an explicit line prefix", () => {
    const rows = model({
      competitors: ["Northstar", "Beacon"],
      notes: "Observed Northstar - UGC video - https://www.facebook.com/ads/library/?id=1\nNorthstar: proof-led offer - https://www.facebook.com/ads/library/?id=2\n[Beacon] carousel - https://www.facebook.com/ads/library/?id=3",
    }).manualRows;

    expect(rows).toEqual([
      expect.objectContaining({ advertiser: undefined, status: "needs_review" }),
      expect.objectContaining({ advertiser: "Northstar", status: "accepted" }),
      expect.objectContaining({ advertiser: "Beacon", status: "accepted" }),
    ]);
  });

  it("does not link a competitor name found only as a single ambiguous character", () => {
    const rows = model({ competitors: ["A"], notes: "UGC campaign with Send Message CTA" }).manualRows;

    expect(rows[0]).toEqual(expect.objectContaining({ advertiser: undefined, status: "needs_review" }));
  });
});

describe("canVerifyCompetitorEvidence", () => {
  it.each([
    [provenance(), true],
    [provenance({ sourceUrl: "http://www.facebook.com/ads/library/?id=1" }), false],
    [provenance({ sourceUrl: "https://example.com/ads/library/?id=1" }), false],
    [provenance({ sourceUrl: undefined }), false],
    [provenance({ matchedToCompetitor: false }), false],
    [undefined, false],
  ])("requires a matched advertiser and a trusted source (%#)", (evidence, expected) => {
    expect(canVerifyCompetitorEvidence(evidence)).toBe(expected);
  });
});

describe("deriveCompetitorEvidenceModel", () => {
  it("counts only accepted, matched, media-ready ads plus accepted manual notes as analyzable", () => {
    const result = model({
      notes: "Northstar - UGC video - https://www.facebook.com/ads/library/?id=101",
      evidence: fetchResult([
        ad("analyzable"),
        ad("no-creative", { hasUsableCreative: false }),
        ad("pending", { status: "needs_review", match: "ambiguous", reason: "similar_advertiser" }),
        ad("rejected", { status: "rejected", match: "mismatch", reason: "advertiser_mismatch", matchedToCompetitor: false }),
      ]),
    });

    expect(result.analyzableAds.map((item) => item.id)).toEqual(["analyzable"]);
    expect(result.analyzableCount).toBe(2);
    expect(result.acceptedCount).toBe(3);
    expect(result.reviewCount).toBe(1);
    expect(result.matchedCount).toBe(4);
    expect(result.totalRecordCount).toBe(5);
    expect(result.evidenceSourceCount).toBe(2);
  });

  it("builds per-competitor coverage across collected ads and manual notes", () => {
    const result = model({
      competitors: ["Northstar", "Beacon"],
      notes: "Beacon - carousel - https://www.facebook.com/ads/library/?id=101\nBeacon - missing source",
      evidence: fetchResult([
        ad("northstar-1"),
        ad("northstar-2", { status: "needs_review" }),
        ad("unrelated", { requestedCompetitor: "Unattributed result", matchedToCompetitor: false, status: "rejected" }),
      ]),
    });

    expect(result.coverage).toEqual([
      { competitor: "Northstar", collected: 2, accepted: 1, needsReview: 1 },
      { competitor: "Beacon", collected: 2, accepted: 1, needsReview: 1 },
    ]);
  });

  it.each([
    ["setup without competitors", { competitors: [] as string[] }, "setup", "ready", false],
    ["collect while collecting", { collecting: true }, "collect", "working", false],
    ["analyze while analyzing", {
      analyzing: true,
      notes: "Northstar - UGC - https://www.facebook.com/ads/library/?id=101",
    }, "analyze", "working", false],
    ["collect before first collection", {}, "collect", "ready", false],
    ["collect blocked without Apify or accepted notes", { collectionAvailable: false }, "collect", "blocked", false],
    ["review when evidence needs review", {
      evidence: fetchResult([ad("pending", { status: "needs_review" })]),
    }, "review", "ready", false],
    ["analyze with analyzable evidence", {
      evidence: fetchResult([ad("analyzable")]),
    }, "analyze", "ready", true],
    ["analyze from accepted manual notes without Apify", {
      collectionAvailable: false,
      notes: "Northstar - UGC - https://www.facebook.com/ads/library/?id=101",
    }, "analyze", "ready", true],
    ["collect blocked when every matched ad was discarded", {
      evidence: fetchResult([ad("rejected", { status: "rejected" })]),
    }, "collect", "blocked", false],
  ])("derives %s", (_name, overrides, workflowStage, dockStatus, canAnalyze) => {
    expect(model(overrides)).toEqual(expect.objectContaining({ workflowStage, dockStatus, canAnalyze }));
  });

  it("turns a zero-match collection into the recovery stage even with accepted manual notes", () => {
    const result = model({
      notes: "Northstar - UGC - https://www.facebook.com/ads/library/?id=101",
      evidence: fetchResult([
        ad("unmatched", { status: "rejected", match: "mismatch", reason: "advertiser_mismatch", matchedToCompetitor: false }),
      ]),
    });

    expect(result.zeroMatchCollection).toBe(true);
    expect(result.workflowStage).toBe("recover");
    expect(result.dockStatus).toBe("ready");
  });
});

describe("competitorInputChangeEffects", () => {
  it.each([
    ["names", true, true],
    ["market", true, false],
    ["platform", true, false],
    ["notes", true, false],
    ["libraryUrls", true, true],
  ] satisfies [CompetitorInputField, boolean, boolean][])(
    "editing %s invalidates the brief (%s) and clears collected evidence (%s)",
    (field, invalidatesBrief, clearsCollectedEvidence) => {
      expect(competitorInputChangeEffects(field)).toEqual({ invalidatesBrief, clearsCollectedEvidence });
    },
  );
});
