import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildDailyBudgetModels, JsonBudgetModelStore, refreshDailyBudgetModels } from "@/lib/budget-models";
import { MemoryPipelineStore } from "@/lib/data-pipeline";

const campaignRow = { schemaVersion: "1.0" as const, id: "meta:campaign:c1:2026-07-29", platform: "meta" as const, authority: "owned_performance" as const, grain: "campaign" as const, date: "2026-07-29", campaignId: "c1", spend: 100, impressions: 1000, clicks: 50, conversions: 5, revenue: 250, viewThroughConversions: 0 };

describe("daily budget model refresh", () => {
  it("builds campaign response curves from owned campaign rows only", () => {
    const snapshot = buildDailyBudgetModels([campaignRow, { ...campaignRow, id: "public", authority: "owned_performance", grain: "creative" }], new Date("2026-07-29T01:30:00Z"));
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.curves[0]).toMatchObject({ id: "c1", platform: "meta", currentSpend: 100 });
    expect(snapshot.model.kind).toBe("bayesian_hierarchical_log_roas");
    expect(snapshot.diagnostics[0]).toMatchObject({
      campaignId: "c1",
      observationCount: 1,
    });
  });

  it("aggregates ad-grain connector rows when campaign-grain rows are unavailable", () => {
    const googleAd = { ...campaignRow, platform: "google_ads" as const, grain: "ad" as const, id: "google:a1", campaignId: "google-c1", adId: "a1", spend: 40, revenue: 120 };
    const snapshot = buildDailyBudgetModels([googleAd, { ...googleAd, id: "google:a2", adId: "a2", spend: 60, revenue: 180 }]);
    expect(snapshot.rowCount).toBe(2);
    expect(snapshot.curves[0]).toMatchObject({ id: "google-c1", platform: "google_ads", currentSpend: 100, currentRevenue: 300 });
  });

  it("prefers campaign grain over lower grains to avoid double counting", () => {
    const snapshot = buildDailyBudgetModels([campaignRow, { ...campaignRow, id: "meta:ad:a1", grain: "ad" as const, adId: "a1" }]);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.curves[0].currentSpend).toBe(100);
  });

  it("uses daily campaign observations in the hierarchical posterior", () => {
    const snapshot = buildDailyBudgetModels([
      campaignRow,
      {
        ...campaignRow,
        id: "meta:campaign:c1:2026-07-28",
        date: "2026-07-28",
        spend: 80,
        revenue: 160,
      },
    ]);

    expect(snapshot.diagnostics[0]).toMatchObject({
      campaignId: "c1",
      observationCount: 2,
    });
    expect(snapshot.curves[0]).toMatchObject({
      currentSpend: 180,
      currentRevenue: 410,
    });
  });

  it("persists a refreshed model snapshot", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "budget-models-"));
    try {
      const pipelineStore = new MemoryPipelineStore();
      await pipelineStore.write({ performanceRows: [campaignRow], creativeRows: [], jobs: [], updatedAt: "2026-07-29T01:15:00Z" });
      const modelStore = new JsonBudgetModelStore(path.join(directory, "models.json"));
      await refreshDailyBudgetModels({ pipelineStore, modelStore, now: new Date("2026-07-29T01:30:00Z") });
      expect(await modelStore.read()).toMatchObject({ rowCount: 1, sourceUpdatedAt: "2026-07-29T01:15:00Z" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
