import { describe, expect, it } from "vitest";
import { assessBreakdownWaste } from "../breakdown-waste";
import type { KpiPack, NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "breakdown",
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
  return assessBreakdownWaste(rows, pack);
}

describe("assessBreakdownWaste", () => {
  it("flags a high-spend breakdown with weak primary results as waste", () => {
    const result = assess([
      row({ id: "fb", name: "Facebook Feed", platform: "facebook", spend: 300, impressions: 10000, messages: 3 }),
      row({ id: "ig", name: "Instagram Feed", platform: "instagram", spend: 100, impressions: 8000, messages: 20 }),
      row({ id: "stories", name: "Stories", platform: "instagram", placement: "stories", spend: 100, impressions: 6000, messages: 12 }),
    ]);

    expect(result.status).toBe("waste_detected");
    expect(result.variant).toBe("destructive");
    expect(result.rows[0].name).toBe("Facebook Feed");
    expect(result.rows[0].spendShare).toBeCloseTo(0.6);
    expect(result.summary.en).toContain("Facebook Feed");
  });

  it("marks balanced breakdown performance as clean", () => {
    const result = assess([
      row({ id: "fb", name: "Facebook Feed", spend: 150, impressions: 10000, messages: 18 }),
      row({ id: "ig", name: "Instagram Feed", spend: 150, impressions: 9000, messages: 17 }),
      row({ id: "stories", name: "Stories", spend: 100, impressions: 7000, messages: 12 }),
    ]);

    expect(result.status).toBe("clean");
    expect(result.variant).toBe("secondary");
    expect(result.rows).toHaveLength(0);
    expect(result.summary.en).toContain("No major breakdown waste");
  });

  it("marks too few breakdown rows as insufficient data", () => {
    const result = assess([row({ id: "fb", name: "Facebook Feed", spend: 100, messages: 10 })]);

    expect(result.status).toBe("insufficient_data");
    expect(result.variant).toBe("outline");
    expect(result.summary.vi.toLowerCase()).toContain("chưa đủ");
  });

  it("uses the selected KPI pack primary result", () => {
    const result = assess(
      [
        row({ id: "traffic", name: "Traffic Placement", spend: 250, linkClicks: 20 }),
        row({ id: "efficient", name: "Efficient Placement", spend: 100, linkClicks: 80 }),
        row({ id: "third", name: "Third Placement", spend: 100, linkClicks: 50 }),
      ],
      "traffic",
    );

    expect(result.status).toBe("waste_detected");
    expect(result.rows[0].name).toBe("Traffic Placement");
    expect(result.summary.en).toContain("Traffic Placement");
  });
});
