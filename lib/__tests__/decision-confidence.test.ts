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

  it("requires 5x target CPA spend before zero-result kill decisions", () => {
    const confidence = assessDecisionConfidence(
      row({ spend: 240, impressions: 5000, leads: 0, ctr: 0.4 }),
      "lead_gen",
      "en",
      { targetCpa: 50 },
    );

    expect(confidence.status).toBe("insufficient_data");
    expect(confidence.actionable).toBe(false);
    expect(confidence.reasons.en.join(" ")).toContain("5x target CPA spend");
  });

  it("allows zero-result kill decisions after 5x target CPA spend", () => {
    const confidence = assessDecisionConfidence(
      row({ spend: 260, impressions: 5000, leads: 0, ctr: 0.4 }),
      "lead_gen",
      "en",
      { targetCpa: 50 },
    );

    expect(confidence.status).toBe("kill_candidate");
    expect(confidence.actionable).toBe(true);
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

  it("blocks scale when CPA is above the business target", () => {
    const confidence = assessDecisionConfidence(
      row({ spend: 600, impressions: 12000, leads: 12, ctr: 1.7, frequency: 1.8 }),
      "lead_gen",
      "en",
      { targetCpa: 40 },
    );

    expect(confidence.status).toBe("monitor");
    expect(confidence.actionable).toBe(false);
    expect(confidence.reasons.en.join(" ")).toContain("CPA is above target");
  });

  it("allows scale when CPA is within the business target", () => {
    const confidence = assessDecisionConfidence(
      row({ spend: 360, impressions: 12000, leads: 12, ctr: 1.7, frequency: 1.8 }),
      "lead_gen",
      "en",
      { targetCpa: 40 },
    );

    expect(confidence.status).toBe("scale_candidate");
    expect(confidence.reasons.en.join(" ")).toContain("CPA target met");
  });

  it("blocks sales scale when ROAS is below target", () => {
    const confidence = assessDecisionConfidence(
      row({ spend: 600, impressions: 12000, purchases: 12, roas: 1.8, ctr: 1.7, frequency: 1.8 }),
      "sales_roas",
      "en",
      { targetRoas: 2.5 },
    );

    expect(confidence.status).toBe("monitor");
    expect(confidence.actionable).toBe(false);
    expect(confidence.reasons.en.join(" ")).toContain("ROAS is below target");
  });

  it("marks rows above 3x target CPA as kill candidates after enough result evidence", () => {
    const confidence = assessDecisionConfidence(
      row({ spend: 650, impressions: 15000, leads: 10, ctr: 1.2, frequency: 2.1 }),
      "lead_gen",
      "en",
      { targetCpa: 20 },
    );

    expect(confidence.status).toBe("kill_candidate");
    expect(confidence.actionable).toBe(true);
    expect(confidence.reasons.en.join(" ")).toContain("3.25x above target CPA");
  });

  it("does not apply the 3x target CPA kill rule before minimum result evidence", () => {
    const confidence = assessDecisionConfidence(
      row({ spend: 260, impressions: 8000, leads: 4, ctr: 1.2, frequency: 2.1 }),
      "lead_gen",
      "en",
      { targetCpa: 20 },
    );

    expect(confidence.status).toBe("monitor");
    expect(confidence.actionable).toBe(false);
    expect(confidence.reasons.en.join(" ")).not.toContain("3x target CPA");
  });
});
