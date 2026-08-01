import { describe, expect, it } from "vitest";
import { buildPlatformEfficiencyPoints } from "@/lib/segment-efficiency";
import type { NormalizedRow } from "@/lib/types";

function row(input: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "breakdown",
    name: "Campaign name",
    spend: 100,
    impressions: 1000,
    reach: 800,
    frequency: 1.25,
    clicks: 20,
    linkClicks: 10,
    ctr: 2,
    cpc: 5,
    cpm: 100,
    messages: 10,
    replies: 0,
    leads: 0,
    purchases: 0,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: 10,
    costPerReply: 0,
    cpl: 0,
    cpaPurchase: 0,
    roas: 0,
    replyRate: 0,
    leadRate: 0,
    metricAvailability: { messages: "tracked" },
    ...input,
  };
}

describe("platform efficiency points", () => {
  it("aggregates campaign breakdown rows by the actual platform", () => {
    const points = buildPlatformEfficiencyPoints([
      row({ id: "fb-1", platform: "facebook", spend: 100, messages: 10 }),
      row({ id: "fb-2", platform: "facebook", spend: 200, messages: 30 }),
      row({ id: "ig-1", platform: "instagram", spend: 100, messages: 20 }),
    ], "messages");

    expect(points.map((point) => point.label)).toEqual(["Facebook", "Instagram"]);
    expect(points[0].row.spend).toBe(300);
    expect(points[0].row.messages).toBe(40);
  });

  it("does not invent visual separation when platforms have identical efficiency", () => {
    const points = buildPlatformEfficiencyPoints([
      row({ id: "fb", platform: "facebook", spend: 100, messages: 10 }),
      row({ id: "ig", platform: "instagram", spend: 200, messages: 20 }),
    ], "messages");

    expect(points.map((point) => point.left)).toEqual([50, 50]);
    expect(points.map((point) => point.bottom)).toEqual([50, 50]);
  });

  it("omits an untracked outcome instead of substituting reach", () => {
    const points = buildPlatformEfficiencyPoints([
      row({ platform: "facebook", messages: 0, metricAvailability: { messages: "not_tracked" } }),
    ], "messages");

    expect(points).toEqual([]);
  });

  it("omits rows without a real platform instead of using campaign names", () => {
    const points = buildPlatformEfficiencyPoints([
      row({ name: "Campaign fallback", platform: undefined }),
    ], "messages");

    expect(points).toEqual([]);
  });
});
