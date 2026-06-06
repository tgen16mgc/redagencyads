import { describe, expect, it } from "vitest";
import { assessTargetingExclusions } from "../targeting-exclusions";
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

describe("assessTargetingExclusions", () => {
  it("returns clean status when no adsets contain exclusion words", () => {
    const result = assessTargetingExclusions([
      row({ id: "set-1", name: "Prospecting - Lookalike 1%" }),
      row({ id: "set-2", name: "Broad - Open Targeting" }),
    ]);

    expect(result.status).toBe("clean");
    expect(result.flaggedAdsets).toHaveLength(0);
  });

  it("flags adsets with exclusion keywords in their names", () => {
    const result = assessTargetingExclusions([
      row({ id: "set-1", name: "Prospecting - Exclude Customers" }),
      row({ id: "set-2", name: "Broad - No Purchasers" }),
      row({ id: "set-3", name: "Retargeting - LTV" }),
    ]);

    expect(result.status).toBe("warning");
    expect(result.flaggedAdsets).toHaveLength(2);
    expect(result.flaggedAdsets[0].adsetName).toBe("Prospecting - Exclude Customers");
    expect(result.flaggedAdsets[0].reason.en).toContain("exclusions are fully phased out");
  });
});
