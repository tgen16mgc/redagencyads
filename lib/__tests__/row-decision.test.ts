import { describe, expect, it } from "vitest";
import { primaryResult, rowDecision } from "../row-decision";
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

describe("primaryResult", () => {
  it("selects the selected KPI pack's primary result", () => {
    const input = row({ messages: 3, leads: 4, purchases: 5, linkClicks: 6, reach: 7 });

    expect(primaryResult(input, "messages")).toBe(3);
    expect(primaryResult(input, "lead_gen")).toBe(4);
    expect(primaryResult(input, "sales_roas")).toBe(5);
    expect(primaryResult(input, "traffic")).toBe(6);
    expect(primaryResult(input, "awareness")).toBe(7);
  });
});

describe("rowDecision", () => {
  it("flags fatigue when frequency crosses the pack guardrail and CTR is weak", () => {
    expect(rowDecision(row({ frequency: 3, ctr: 0.9 }), "messages")).toMatchObject({ intent: "danger", label: "Fix creative" });
    expect(rowDecision(row({ frequency: 4, ctr: 0.9 }), "awareness")).toMatchObject({ intent: "danger" });
  });

  it("marks rows with result, CTR, and frequency guardrails as healthy", () => {
    expect(rowDecision(row({ messages: 2, ctr: 1.2, frequency: 2 }), "messages")).toMatchObject({ intent: "good", label: "Healthy" });
  });

  it("uses Vietnamese labels", () => {
    expect(rowDecision(row({ spend: 10, messages: 0 }), "messages", "vi")).toMatchObject({ label: "Chưa đủ dữ liệu" });
  });

  it("downgrades low-delivery fatigue signals to insufficient data", () => {
    expect(rowDecision(row({ spend: 20, impressions: 300, frequency: 3.5, ctr: 0.3 }), "messages")).toMatchObject({
      intent: "neutral",
      label: "Insufficient data",
    });
  });
});
