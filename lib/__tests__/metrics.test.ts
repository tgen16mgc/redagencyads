import { describe, expect, it } from "vitest";
import { detectKpiPack, normalizeRows, scoreHealth, sumRows } from "../metrics";
import type { InsightRow, NormalizedRow } from "../types";

function normalized(overrides: Partial<NormalizedRow>): NormalizedRow {
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

describe("normalizeRows", () => {
  it("maps Meta action rows into NormalizedRow metrics", () => {
    const rows: InsightRow[] = [
      {
        campaign_id: "campaign-1",
        campaign_name: "Lead campaign",
        spend: "100",
        impressions: "10000",
        reach: "5000",
        frequency: "2",
        clicks: "300",
        inline_link_clicks: "120",
        ctr: "3",
        cpc: "0.33",
        cpm: "10",
        actions: [
          { action_type: "onsite_conversion.total_messaging_connection", value: "10" },
          { action_type: "lead", value: "4" },
          { action_type: "purchase", value: "2" },
        ],
        cost_per_action_type: [
          { action_type: "onsite_conversion.total_messaging_connection", value: "10" },
          { action_type: "lead", value: "25" },
          { action_type: "purchase", value: "50" },
        ],
        purchase_roas: [{ action_type: "purchase", value: "2.5" }],
      },
    ];

    expect(normalizeRows(rows, "campaign")[0]).toMatchObject({
      id: "campaign-1",
      name: "Lead campaign",
      spend: 100,
      messages: 10,
      leads: 4,
      purchases: 2,
      costPerMessage: 10,
      cpl: 25,
      cpaPurchase: 50,
      roas: 2.5,
    });
  });
});

describe("sumRows", () => {
  it("aggregates frequency from total impressions and reach", () => {
    const total = sumRows([
      normalized({ impressions: 1000, reach: 500, frequency: 2 }),
      normalized({ impressions: 9000, reach: 9000, frequency: 1 }),
    ], "Total");

    expect(total.frequency).toBeCloseTo(10000 / 9500);
  });

  it("aggregates ROAS as a spend-weighted average", () => {
    const total = sumRows([
      normalized({ spend: 100, roas: 10 }),
      normalized({ spend: 10000, roas: 1.2 }),
    ], "Total");

    expect(total.roas).toBeCloseTo(13000 / 10100);
  });
});

describe("detectKpiPack", () => {
  it("respects strong message signal over lead signal", () => {
    const detected = detectKpiPack(
      [{ id: "1", name: "Inbox campaign" }],
      [normalized({ messages: 20, leads: 4 })],
      [],
    );

    expect(detected.pack).toBe("messages");
  });

  it("falls back to awareness when no lower-funnel signal exists", () => {
    const detected = detectKpiPack([{ id: "1", name: "Brand reach" }], [normalized({ impressions: 1000 })], []);

    expect(detected.pack).toBe("awareness");
  });
});

describe("scoreHealth", () => {
  it("scores healthy report inputs as an A", () => {
    const health = scoreHealth({
      totals: normalized({ ctr: 1.2, frequency: 2 }),
      campaignRows: [normalized({ id: "campaign-1" })],
      adsetRows: [],
      adRows: Array.from({ length: 10 }, (_, index) => normalized({ id: `ad-${index}` })),
    });

    expect(health.grade).toBe("A");
    expect(health.checks.every((check) => check.status === "pass")).toBe(true);
  });
});
