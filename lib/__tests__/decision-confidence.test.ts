import { describe, expect, it } from "vitest";
import { assessDecisionConfidence } from "../decision-confidence";
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

describe("assessDecisionConfidence", () => {
  it("blocks action when spend and delivery are too thin", () => {
    const confidence = assessDecisionConfidence(row({ spend: 20, impressions: 300, leads: 0, ctr: 0.3 }), "lead_gen");

    expect(confidence.status).toBe("insufficient_data");
    expect(confidence.actionable).toBe(false);
    expect(confidence.reasons.en.join(" ")).toContain("Need at least 1,000 impressions");
  });

  it("marks zero-result waste as a kill candidate only after enough spend and delivery", () => {
    const confidence = assessDecisionConfidence(row({ spend: 250, impressions: 5000, leads: 0, ctr: 0.4 }), "lead_gen");

    expect(confidence.status).toBe("kill_candidate");
    expect(confidence.actionable).toBe(true);
    expect(confidence.reasons.en.join(" ")).toContain("enough spend and delivery");
  });

  it("marks strong result rows as scale candidates when volume is sufficient", () => {
    const confidence = assessDecisionConfidence(row({ spend: 500, impressions: 12000, leads: 12, ctr: 1.7, frequency: 1.8 }), "lead_gen");

    expect(confidence.status).toBe("scale_candidate");
    expect(confidence.actionable).toBe(true);
  });

  it("uses Vietnamese labels and reasons", () => {
    const confidence = assessDecisionConfidence(row({ spend: 20, impressions: 300, messages: 0 }), "messages", "vi");

    expect(confidence.label.vi).toBe("Chưa đủ dữ liệu");
    expect(confidence.reasons.vi.join(" ")).toContain("1.000 impressions");
  });
});
