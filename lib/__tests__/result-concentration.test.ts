import { describe, expect, it } from "vitest";
import { assessResultConcentration } from "../result-concentration";
import type { KpiPack, NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "campaign",
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

function assess(rows: NormalizedRow[], pack: KpiPack = "messages") {
  return assessResultConcentration(rows, pack);
}

describe("assessResultConcentration", () => {
  it("marks evenly distributed primary results as low risk", () => {
    const result = assess([
      row({ id: "a", name: "Campaign A", spend: 100, messages: 25 }),
      row({ id: "b", name: "Campaign B", spend: 95, messages: 24 }),
      row({ id: "c", name: "Campaign C", spend: 90, messages: 23 }),
      row({ id: "d", name: "Campaign D", spend: 85, messages: 22 }),
      row({ id: "e", name: "Campaign E", spend: 80, messages: 20 }),
      row({ id: "f", name: "Campaign F", spend: 75, messages: 18 }),
    ]);

    expect(result.status).toBe("low_risk");
    expect(result.variant).toBe("secondary");
    expect(result.topRows).toHaveLength(3);
    expect(result.summary.en).toContain("distributed");
  });

  it("marks one dominant row as high risk", () => {
    const result = assess([
      row({ id: "a", name: "Hero Campaign", spend: 200, messages: 70 }),
      row({ id: "b", name: "Campaign B", spend: 80, messages: 10 }),
      row({ id: "c", name: "Campaign C", spend: 70, messages: 10 }),
      row({ id: "d", name: "Campaign D", spend: 60, messages: 10 }),
    ]);

    expect(result.status).toBe("high_risk");
    expect(result.variant).toBe("destructive");
    expect(result.topRows[0].name).toBe("Hero Campaign");
    expect(result.topRows[0].resultShare).toBeCloseTo(0.7);
    expect(result.summary.en).toContain("70.0%");
  });

  it("marks top three result dependency as medium risk", () => {
    const result = assess([
      row({ id: "a", name: "Campaign A", spend: 120, messages: 35 }),
      row({ id: "b", name: "Campaign B", spend: 115, messages: 30 }),
      row({ id: "c", name: "Campaign C", spend: 110, messages: 15 }),
      row({ id: "d", name: "Campaign D", spend: 100, messages: 20 }),
    ]);

    expect(result.status).toBe("medium_risk");
    expect(result.variant).toBe("outline");
    expect(result.summary.en).toContain("top 3");
  });

  it("uses spend concentration when primary results are not available", () => {
    const result = assess([
      row({ id: "a", name: "Big Spender", spend: 700, messages: 0 }),
      row({ id: "b", name: "Campaign B", spend: 100, messages: 0 }),
      row({ id: "c", name: "Campaign C", spend: 100, messages: 0 }),
      row({ id: "d", name: "Campaign D", spend: 100, messages: 0 }),
    ]);

    expect(result.status).toBe("high_risk");
    expect(result.topRows[0].name).toBe("Big Spender");
    expect(result.summary.en).toContain("spend");
  });

  it("marks too few rows as insufficient data", () => {
    const result = assess([row({ id: "a", name: "Only Campaign", spend: 100, messages: 10 })]);

    expect(result.status).toBe("insufficient_data");
    expect(result.variant).toBe("outline");
    expect(result.topRows).toHaveLength(1);
    expect(result.summary.vi.toLowerCase()).toContain("chưa đủ");
  });
});
