import { describe, expect, it } from "vitest";
import { classifyCreativeFatigue } from "../creative-fatigue";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "ad",
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

describe("classifyCreativeFatigue", () => {
  it("marks high-frequency low-CTR rows as fatigued", () => {
    const result = classifyCreativeFatigue(row({ frequency: 5.4, ctr: 0.42, spend: 120, impressions: 12000 }));

    expect(result.status).toBe("fatigued");
    expect(result.severity).toBe("danger");
    expect(result.label.en).toBe("Fatigued / Rotate creative");
    expect(result.label.vi).toBe("Mỏi creative / Nên thay mẫu");
    expect(result.reason.en).toContain("frequency 5.40");
  });

  it("marks elevated-frequency acceptable-CTR rows as watch", () => {
    const result = classifyCreativeFatigue(row({ frequency: 3.6, ctr: 1.15, spend: 90, impressions: 9000 }));

    expect(result.status).toBe("watch");
    expect(result.severity).toBe("warning");
    expect(result.label.en).toBe("Watch");
  });

  it("keeps low-frequency healthy rows fresh", () => {
    const result = classifyCreativeFatigue(row({ frequency: 1.8, ctr: 1.6, spend: 80, impressions: 8000 }));

    expect(result.status).toBe("fresh");
    expect(result.severity).toBe("secondary");
    expect(result.label.en).toBe("Fresh / Keep testing");
  });

  it("does not flag low-volume rows as fatigued", () => {
    const result = classifyCreativeFatigue(row({ frequency: 6.2, ctr: 0.2, spend: 8, impressions: 450 }));

    expect(result.status).toBe("fresh");
    expect(result.reason.en).toContain("insufficient delivery");
  });
});
