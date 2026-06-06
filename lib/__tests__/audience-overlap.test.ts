import { describe, expect, it } from "vitest";
import { assessAudienceOverlap } from "../audience-overlap";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "adset",
    name: "Row",
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    linkClicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    messages: 0,
    replies: 0,
    leads: 0,
    purchases: 0,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: 0,
    costPerReply: 0,
    cpl: 0,
    cpaPurchase: 0,
    roas: 0,
    replyRate: 0,
    leadRate: 0,
    ...overrides,
  };
}

describe("assessAudienceOverlap", () => {
  it("flags high overlap risk when ad sets have highly similar names", () => {
    const result = assessAudienceOverlap([
      row({ id: "1", name: "Lookalike 1% - Purchase - VN", spend: 300 }),
      row({ id: "2", name: "LAL 1% Purchases Vietnam", spend: 200 }),
      row({ id: "3", name: "Broad Target Male 18+", spend: 100 }),
    ]);

    expect(result.status).toBe("overlap_risk");
    expect(result.variant).toBe("destructive");
    expect(result.pairs[0].name1).toBe("Lookalike 1% - Purchase - VN");
    expect(result.pairs[0].name2).toBe("LAL 1% Purchases Vietnam");
    expect(result.summary.en).toContain("overlap");
  });

  it("marks distinct ad set names as clean", () => {
    const result = assessAudienceOverlap([
      row({ id: "1", name: "Broad - Male - 25-45", spend: 300 }),
      row({ id: "2", name: "Interest - E-commerce", spend: 200 }),
      row({ id: "3", name: "Retargeting - Page Engagement", spend: 100 }),
    ]);

    expect(result.status).toBe("clean");
    expect(result.variant).toBe("secondary");
    expect(result.pairs).toHaveLength(0);
  });

  it("marks low active ad set count as insufficient data", () => {
    const result = assessAudienceOverlap([
      row({ id: "1", name: "Broad - Male - 25-45", spend: 300 }),
    ]);

    expect(result.status).toBe("insufficient_data");
    expect(result.variant).toBe("outline");
    expect(result.summary.vi.toLowerCase()).toContain("tối thiểu");
  });
});
