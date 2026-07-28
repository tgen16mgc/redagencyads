import { describe, expect, it } from "vitest";
import { primaryResultSpec, primaryResultValue, signalVolumeValue } from "../primary-result";
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

describe("primaryResultSpec", () => {
  it("maps each Selected KPI Pack to its Primary Result and cost metric", () => {
    expect(primaryResultSpec("messages")).toMatchObject({ resultKey: "messages", costKey: "costPerMessage" });
    expect(primaryResultSpec("lead_gen")).toMatchObject({ resultKey: "leads", costKey: "cpl" });
    expect(primaryResultSpec("sales_roas")).toMatchObject({ resultKey: "purchases", costKey: "cpaPurchase" });
    expect(primaryResultSpec("traffic")).toMatchObject({ resultKey: "linkClicks", costKey: "cpc" });
  });

  it("gives awareness no budget-scalable Primary Result and reach as signal volume", () => {
    expect(primaryResultSpec("awareness")).toMatchObject({ resultKey: null, costKey: null, volumeKey: "reach" });
  });

  it("uses the Primary Result itself as signal volume for conversion-scale packs", () => {
    (["messages", "lead_gen", "sales_roas", "traffic"] as const).forEach((pack) => {
      expect(primaryResultSpec(pack).volumeKey).toBe(primaryResultSpec(pack).resultKey);
    });
  });

  it("carries bilingual result and cost labels", () => {
    expect(primaryResultSpec("messages").resultLabel).toEqual({ en: "messages", vi: "tin nhắn" });
    expect(primaryResultSpec("traffic").costLabel).toEqual({ en: "CPC", vi: "CPC" });
    expect(primaryResultSpec("awareness").costLabel.en).toBe("CTR/CPM/frequency");
    expect(primaryResultSpec("awareness").volumeLabel).toEqual({ en: "reach", vi: "người tiếp cận" });
  });
});

describe("primaryResultValue and signalVolumeValue", () => {
  const input = row({ messages: 3, leads: 4, purchases: 5, linkClicks: 6, reach: 7 });

  it("reads the pack-specific Primary Result from a row", () => {
    expect(primaryResultValue(input, "messages")).toBe(3);
    expect(primaryResultValue(input, "lead_gen")).toBe(4);
    expect(primaryResultValue(input, "sales_roas")).toBe(5);
    expect(primaryResultValue(input, "traffic")).toBe(6);
  });

  it("returns zero Primary Result for awareness but reach as signal volume", () => {
    expect(primaryResultValue(input, "awareness")).toBe(0);
    expect(signalVolumeValue(input, "awareness")).toBe(7);
    expect(signalVolumeValue(input, "lead_gen")).toBe(4);
  });
});
