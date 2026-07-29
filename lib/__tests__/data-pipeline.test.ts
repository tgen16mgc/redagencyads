import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ingestConnectorResult, incrementalWindow, JsonFilePipelineStore, MemoryPipelineStore, monthlyBackfillWindows, pipelineHealth } from "@/lib/data-pipeline";

describe("idempotent cross-channel pipeline", () => {
  it("creates 13 monthly windows and an incremental lookback", () => {
    const windows = monthlyBackfillWindows(new Date("2026-07-29T00:00:00Z"), 13);
    expect(windows).toHaveLength(13);
    expect(windows.at(-1)).toEqual({ since: "2026-07-01", until: "2026-07-29" });
    expect(incrementalWindow(new Date("2026-07-29T00:00:00Z"), 3)).toEqual({ since: "2026-07-26", until: "2026-07-29" });
  });

  it("upserts rows and skips a completed duplicate job", async () => {
    const store = new MemoryPipelineStore();
    const result = { platform: "google_ads" as const, source: "test", fetchedAt: new Date().toISOString(), rows: [{ schemaVersion: "1.0" as const, id: "r1", platform: "google_ads" as const, authority: "owned_performance" as const, grain: "campaign" as const, date: "2026-07-01", spend: 10, impressions: 100, clicks: 2, conversions: 1, revenue: 20, viewThroughConversions: 0 }], creatives: [], warnings: [] };
    const first = await ingestConnectorResult(store, { result, mode: "full", window: { since: "2026-07-01", until: "2026-07-01" } });
    const second = await ingestConnectorResult(store, { result, mode: "full", window: { since: "2026-07-01", until: "2026-07-01" } });
    expect(first.status).toBe("succeeded");
    expect(second.id).toBe(first.id);
    expect((await store.read()).performanceRows).toHaveLength(1);
    expect(pipelineHealth(await store.read()).status).toBe("healthy");
  });

  it("persists pipeline snapshots atomically across store instances", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "decision-pipeline-"));
    const filePath = path.join(directory, "pipeline.json");
    try {
      const firstStore = new JsonFilePipelineStore(filePath);
      await firstStore.write({ performanceRows: [], creativeRows: [], jobs: [], updatedAt: "2026-07-29T00:00:00.000Z" });
      const secondStore = new JsonFilePipelineStore(filePath);
      expect(await secondStore.read()).toEqual({ performanceRows: [], creativeRows: [], jobs: [], updatedAt: "2026-07-29T00:00:00.000Z" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed and preserves prior data when a schema quality gate fails", async () => {
    const store = new MemoryPipelineStore();
    const valid = { platform: "google_ads" as const, source: "test", fetchedAt: new Date().toISOString(), rows: [{ schemaVersion: "1.0" as const, id: "valid", platform: "google_ads" as const, authority: "owned_performance" as const, grain: "campaign" as const, date: "2026-07-01", spend: 10, impressions: 100, clicks: 2, conversions: 1, revenue: 20, viewThroughConversions: 0 }], creatives: [], warnings: [] };
    await ingestConnectorResult(store, { result: valid, mode: "full", window: { since: "2026-07-01", until: "2026-07-01" } });
    const invalid = { ...valid, rows: [{ ...valid.rows[0], id: "invalid", schemaVersion: "2.0" as "1.0" }] };
    const failed = await ingestConnectorResult(store, { result: invalid, mode: "incremental", window: { since: "2026-07-02", until: "2026-07-02" } });
    expect(failed).toMatchObject({ status: "failed", error: "Data quality gates failed: schema_drift." });
    expect((await store.read()).performanceRows.map((row) => row.id)).toEqual(["valid"]);
    expect(pipelineHealth(await store.read()).status).toBe("failed");
  });

  it("retains an empty sync as a warning without deleting previous rows", async () => {
    const store = new MemoryPipelineStore();
    const empty = { platform: "linkedin" as const, source: "test", fetchedAt: new Date().toISOString(), rows: [], creatives: [], warnings: [] };
    const job = await ingestConnectorResult(store, { result: empty, mode: "incremental", window: { since: "2026-07-01", until: "2026-07-01" } });
    expect(job.status).toBe("succeeded");
    expect(job.quality.find((gate) => gate.id === "row_counts")?.status).toBe("warning");
  });
});
