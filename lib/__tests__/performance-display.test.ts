import { describe, expect, it } from "vitest";
import { buildDriverConcentration, evidenceCostLabel, selectStageContributors, trackedOutcomeValue } from "../performance-display";
import type { NormalizedRow } from "../types";

function row(input: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: String(input.id || "row"),
    level: "adset",
    name: String(input.name || "Row"),
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
    ...input,
  };
}

describe("performance display contracts", () => {
  it("reports the measured top-three result concentration", () => {
    const concentration = buildDriverConcentration([
      row({ id: "a", messages: 50, spend: 500 }),
      row({ id: "b", messages: 30, spend: 300 }),
      row({ id: "c", messages: 10, spend: 100 }),
      row({ id: "d", messages: 10, spend: 100 }),
    ], "messages");

    expect(concentration).toEqual({ basis: "results", count: 3, share: 90 });
  });

  it("falls back to spend concentration when the outcome is zero", () => {
    expect(buildDriverConcentration([
      row({ id: "a", spend: 80 }),
      row({ id: "b", spend: 20 }),
    ], "messages")).toEqual({ basis: "spend", count: 2, share: 100 });
  });

  it("uses the active KPI cost label and never renders untracked ROAS as zero", () => {
    const untracked = row({ metricAvailability: { purchases: "not_tracked" } });
    expect(evidenceCostLabel("messages", "en")).toBe("Cost/message");
    expect(evidenceCostLabel("messages", "vi")).toBe("Chi phí/tin nhắn");
    expect(trackedOutcomeValue(untracked, "purchases", "0.0", "en")).toBe("Not tracked");
    expect(trackedOutcomeValue(untracked, "purchases", "0.0", "vi")).toBe("Chưa theo dõi");
  });

  it("ranks funnel contributors by the focused stage instead of spend", () => {
    const selection = selectStageContributors([
      row({ id: "high-spend", spend: 1000, leads: 1 }),
      row({ id: "high-leads", spend: 100, leads: 20 }),
      row({ id: "middle", spend: 500, leads: 8 }),
    ], "lead", 2);

    expect(selection.basis).toBe("leads");
    expect(selection.rows.map((item) => item.id)).toEqual(["high-leads", "middle"]);
  });

  it("falls back to spend when the focused stage has no measurable signal", () => {
    const selection = selectStageContributors([
      row({ id: "a", spend: 100 }),
      row({ id: "b", spend: 300 }),
    ], "purchase");

    expect(selection.basis).toBe("spend");
    expect(selection.rows.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
