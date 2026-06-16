import { describe, expect, it } from "vitest";
import { detectKpiPack, formatMetric, normalizeRows, scoreHealth, sumRows } from "../metrics";
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

describe("normalizeRows edge cases", () => {
  it("recognizes alternate messaging action types and computes reply/lead rates", () => {
    const rows: InsightRow[] = [
      {
        campaign_id: "c1",
        campaign_name: "Inbox",
        spend: "50",
        actions: [
          { action_type: "messaging_conversation_started_7d", value: "20" },
          { action_type: "onsite_conversion.messaging_conversation_replied_7d", value: "5" },
          { action_type: "lead", value: "2" },
        ],
      },
    ];

    const row = normalizeRows(rows, "campaign")[0];
    expect(row.messages).toBe(20);
    expect(row.replies).toBe(5);
    expect(row.replyRate).toBeCloseTo((5 / 20) * 100);
    expect(row.leadRate).toBeCloseTo((2 / 20) * 100);
  });

  it("derives per-action costs by dividing spend when cost_per_action_type is absent", () => {
    const rows: InsightRow[] = [
      {
        campaign_id: "c1",
        campaign_name: "No cost map",
        spend: "100",
        actions: [
          { action_type: "onsite_conversion.total_messaging_connection", value: "10" },
          { action_type: "lead", value: "5" },
          { action_type: "purchase", value: "4" },
        ],
      },
    ];

    const row = normalizeRows(rows, "campaign")[0];
    expect(row.costPerMessage).toBeCloseTo(100 / 10);
    expect(row.cpl).toBeCloseTo(100 / 5);
    expect(row.cpaPurchase).toBeCloseTo(100 / 4);
  });

  it("falls back to the link_click action when inline_link_clicks is missing", () => {
    const rows: InsightRow[] = [
      {
        campaign_id: "c1",
        campaign_name: "Traffic",
        spend: "10",
        actions: [{ action_type: "link_click", value: "42" }],
      },
    ];

    expect(normalizeRows(rows, "campaign")[0].linkClicks).toBe(42);
  });

  it("uses website_purchase_roas when purchase_roas is absent", () => {
    const rows: InsightRow[] = [
      {
        campaign_id: "c1",
        campaign_name: "Catalog",
        spend: "200",
        website_purchase_roas: [{ action_type: "offsite_conversion.purchase", value: "3.4" }],
      },
    ];

    expect(normalizeRows(rows, "campaign")[0].roas).toBeCloseTo(3.4);
  });

  it("zero-fills metrics for an empty row and synthesizes an id from level and index", () => {
    const row = normalizeRows([{}], "ad")[0];
    expect(row.id).toBe("ad-0");
    expect(row.name).toBe("Account total");
    expect(row.spend).toBe(0);
    expect(row.messages).toBe(0);
    expect(row.roas).toBe(0);
    expect(row.costPerMessage).toBe(0);
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

  it("weights signal-quality checks (CTR, frequency) at 30pts and structural checks at 20pts", () => {
    // Only CTR passes (30pts) + frequency passes (30pts) = 60pts — structural both fail
    const health = scoreHealth({
      totals: normalized({ ctr: 1.2, frequency: 2 }),
      campaignRows: Array.from({ length: 8 }, (_, i) => normalized({ id: `c${i}` })),
      adsetRows: [],
      adRows: [normalized({ id: "ad-1" })],
    });

    expect(health.score).toBe(66);
    expect(health.grade).toBe("C");
  });

  it("gives max score of 100 with all checks passing under new weights", () => {
    const health = scoreHealth({
      totals: normalized({ ctr: 1.2, frequency: 2 }),
      campaignRows: [normalized({ id: "c1" })],
      adsetRows: [],
      adRows: Array.from({ length: 10 }, (_, i) => normalized({ id: `ad-${i}` })),
    });

    expect(health.score).toBe(100);
  });
});

describe("scoreHealth CTR pack-aware benchmarks", () => {
  it("passes CTR check for traffic pack at 1.6% (above 1.5% threshold)", () => {
    const health = scoreHealth({
      totals: normalized({ ctr: 1.6, frequency: 2 }),
      campaignRows: [normalized({ id: "c1" })],
      adsetRows: [],
      adRows: Array.from({ length: 10 }, (_, i) => normalized({ id: `ad-${i}` })),
      pack: "traffic",
    });
    const ctrCheck = health.checks.find((c) => c.id === "M-CR4");
    expect(ctrCheck?.status).toBe("pass");
  });

  it("fails CTR check for traffic pack at 0.8% (below 0.9% warning floor)", () => {
    const health = scoreHealth({
      totals: normalized({ ctr: 0.8, frequency: 2 }),
      campaignRows: [normalized({ id: "c1" })],
      adsetRows: [],
      adRows: Array.from({ length: 10 }, (_, i) => normalized({ id: `ad-${i}` })),
      pack: "traffic",
    });
    const ctrCheck = health.checks.find((c) => c.id === "M-CR4");
    expect(ctrCheck?.status).toBe("fail");
  });

  it("passes CTR check for awareness pack at 0.6% (above 0.4% threshold)", () => {
    const health = scoreHealth({
      totals: normalized({ ctr: 0.6, frequency: 2 }),
      campaignRows: [normalized({ id: "c1" })],
      adsetRows: [],
      adRows: Array.from({ length: 10 }, (_, i) => normalized({ id: `ad-${i}` })),
      pack: "awareness",
    });
    const ctrCheck = health.checks.find((c) => c.id === "M-CR4");
    expect(ctrCheck?.status).toBe("pass");
  });

  it("fails CTR check for awareness pack at 0.2% (below 0.3% warning threshold)", () => {
    const health = scoreHealth({
      totals: normalized({ ctr: 0.2, frequency: 2 }),
      campaignRows: [normalized({ id: "c1" })],
      adsetRows: [],
      adRows: Array.from({ length: 10 }, (_, i) => normalized({ id: `ad-${i}` })),
      pack: "awareness",
    });
    const ctrCheck = health.checks.find((c) => c.id === "M-CR4");
    expect(ctrCheck?.status).toBe("fail");
  });

  it("falls back to lead_gen threshold when no pack provided", () => {
    const health = scoreHealth({
      totals: normalized({ ctr: 1.2, frequency: 2 }),
      campaignRows: [normalized({ id: "c1" })],
      adsetRows: [],
      adRows: Array.from({ length: 10 }, (_, i) => normalized({ id: `ad-${i}` })),
    });
    const ctrCheck = health.checks.find((c) => c.id === "M-CR4");
    expect(ctrCheck?.status).toBe("pass");
  });
});

describe("formatMetric", () => {
  it("formats currency in en-US style for USD", () => {
    const result = formatMetric(1234, "currency", "USD");
    expect(result).toContain("1,234");
    expect(result).toContain("$");
  });

  it("formats currency in vi-VN style for VND", () => {
    const result = formatMetric(1000000, "currency", "VND");
    expect(result).toMatch(/1\.000\.000|1,000,000/);
  });

  it("formats percent with percent sign", () => {
    const result = formatMetric(2.5, "percent", "USD");
    expect(result).toContain("%");
  });

  it("formats ratio with x suffix", () => {
    const result = formatMetric(3.2, "ratio", "USD");
    expect(result).toContain("x");
  });
});
