import { describe, expect, it } from "vitest";
import { classifyCreativeFatigue, computeCreativeFatigueBaseline } from "../creative-fatigue";
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

describe("computeCreativeFatigueBaseline", () => {
  it("returns median frequency and CTR over rows with sufficient delivery", () => {
    const rows = [
      row({ frequency: 2, ctr: 1, spend: 50, impressions: 5000 }),
      row({ frequency: 3, ctr: 2, spend: 50, impressions: 5000 }),
      row({ frequency: 4, ctr: 3, spend: 50, impressions: 5000 }),
    ];
    const baseline = computeCreativeFatigueBaseline(rows);

    expect(baseline).not.toBeNull();
    expect(baseline!.typicalFrequency).toBe(3);
    expect(baseline!.typicalCtr).toBe(2);
    expect(baseline!.sampleSize).toBe(3);
  });

  it("ignores low-delivery rows when computing the baseline", () => {
    const rows = [
      row({ frequency: 2, ctr: 2, spend: 50, impressions: 5000 }),
      row({ frequency: 99, ctr: 0.01, spend: 2, impressions: 100 }),
    ];
    const baseline = computeCreativeFatigueBaseline(rows);

    expect(baseline!.sampleSize).toBe(1);
    expect(baseline!.typicalFrequency).toBe(2);
  });

  it("returns null when no rows have sufficient delivery", () => {
    const rows = [row({ frequency: 4, ctr: 1, spend: 3, impressions: 200 })];
    expect(computeCreativeFatigueBaseline(rows)).toBeNull();
  });
});

describe("classifyCreativeFatigue with a learned baseline", () => {
  it("flags fatigue relative to the account baseline even below the fixed cutoff", () => {
    const baseline = { typicalFrequency: 2, typicalCtr: 2, sampleSize: 8 };
    const result = classifyCreativeFatigue(
      row({ frequency: 3, ctr: 1.2, spend: 90, impressions: 9000 }),
      baseline,
    );

    expect(result.status).toBe("fatigued");
    expect(result.severity).toBe("danger");
  });

  it("does not flag a row that matches the account's high-frequency norm", () => {
    const baseline = { typicalFrequency: 6, typicalCtr: 0.7, sampleSize: 8 };
    const result = classifyCreativeFatigue(
      row({ frequency: 6, ctr: 0.7, spend: 120, impressions: 12000 }),
      baseline,
    );

    expect(result.status).toBe("fresh");
  });
});
