import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { CanonicalCreativeRow, CanonicalPerformanceRow, CanonicalQualityGate } from "@/lib/cross-channel";
import { evaluateQuality } from "@/lib/cross-channel";
import type { ConnectorSyncResult } from "@/lib/connector-adapters";
import { workspaceDataPath } from "@/lib/workspace-storage";

export type SyncMode = "incremental" | "full" | "backfill";
export type SyncStatus = "queued" | "running" | "succeeded" | "failed";

export type SyncWindow = { since: string; until: string };

export type SyncJob = {
  id: string;
  platform: string;
  mode: SyncMode;
  window: SyncWindow;
  status: SyncStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  rowCount: number;
  creativeCount: number;
  warnings: string[];
  quality: CanonicalQualityGate[];
  error?: string;
};

export type PipelineSnapshot = {
  performanceRows: CanonicalPerformanceRow[];
  creativeRows: CanonicalCreativeRow[];
  jobs: SyncJob[];
  updatedAt?: string;
};

export interface PipelineStore {
  read(): Promise<PipelineSnapshot>;
  write(snapshot: PipelineSnapshot): Promise<void>;
}

export class MemoryPipelineStore implements PipelineStore {
  private snapshot: PipelineSnapshot = { performanceRows: [], creativeRows: [], jobs: [] };
  async read() { return structuredClone(this.snapshot); }
  async write(snapshot: PipelineSnapshot) { this.snapshot = structuredClone(snapshot); }
}

export class JsonFilePipelineStore implements PipelineStore {
  private pendingWrite = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async read(): Promise<PipelineSnapshot> {
    await this.pendingWrite;
    try {
      const snapshot = JSON.parse(await readFile(this.filePath, "utf8")) as PipelineSnapshot;
      return {
        performanceRows: Array.isArray(snapshot.performanceRows) ? snapshot.performanceRows : [],
        creativeRows: Array.isArray(snapshot.creativeRows) ? snapshot.creativeRows : [],
        jobs: Array.isArray(snapshot.jobs) ? snapshot.jobs : [],
        updatedAt: snapshot.updatedAt,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { performanceRows: [], creativeRows: [], jobs: [] };
      throw error;
    }
  }

  async write(snapshot: PipelineSnapshot) {
    const next = structuredClone(snapshot);
    this.pendingWrite = this.pendingWrite.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(next, null, 2), "utf8");
      await rename(temporaryPath, this.filePath);
    });
    await this.pendingWrite;
  }
}

let defaultStore: PipelineStore | undefined;
export function getDefaultPipelineStore() {
  if (!defaultStore) {
    defaultStore = process.env.NODE_ENV === "test" || process.env.PIPELINE_STORE_MODE === "memory"
      ? new MemoryPipelineStore()
      : new JsonFilePipelineStore(process.env.PIPELINE_STORE_PATH || workspaceDataPath("pipeline.json"));
  }
  return defaultStore;
}

export function monthlyBackfillWindows(today = new Date(), months = 13): SyncWindow[] {
  const windows: SyncWindow[] = [];
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  for (let index = 0; index < months; index += 1) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const until = index === 0 && today < monthEnd ? today : monthEnd;
    windows.unshift({ since: cursor.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) });
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return windows;
}

export function incrementalWindow(today = new Date(), lookbackDays = 3): SyncWindow {
  const until = new Date(today);
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - Math.max(1, lookbackDays));
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

export function createSyncJob(input: { platform: string; mode: SyncMode; window: SyncWindow; now?: Date }): SyncJob {
  const startedAt = (input.now || new Date()).toISOString();
  return {
    id: `sync:${input.platform}:${input.mode}:${input.window.since}:${input.window.until}`,
    platform: input.platform,
    mode: input.mode,
    window: input.window,
    status: "running",
    startedAt,
    rowCount: 0,
    creativeCount: 0,
    warnings: [],
    quality: [],
  };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]) {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

export async function ingestConnectorResult(store: PipelineStore, input: { result: ConnectorSyncResult; mode: SyncMode; window: SyncWindow; now?: Date }): Promise<SyncJob> {
  const started = Date.now();
  const snapshot = await store.read();
  const duplicateJob = snapshot.jobs.find((job) => job.id === `sync:${input.result.platform}:${input.mode}:${input.window.since}:${input.window.until}` && job.status === "succeeded");
  if (duplicateJob) return duplicateJob;
  const job = createSyncJob({ platform: input.result.platform, mode: input.mode, window: input.window, now: input.now });
  const previousRows = snapshot.performanceRows.filter((row) => row.platform === input.result.platform);
  const quality = evaluateQuality(input.result.rows, previousRows);
  const finishedAt = new Date().toISOString();
  const failedGates = quality.filter((gate) => gate.status === "fail");
  const completed: SyncJob = {
    ...job,
    status: failedGates.length ? "failed" : "succeeded",
    finishedAt,
    durationMs: Date.now() - started,
    rowCount: input.result.rows.length,
    creativeCount: input.result.creatives.length,
    warnings: input.result.warnings,
    quality,
    error: failedGates.length ? `Data quality gates failed: ${failedGates.map((gate) => gate.id).join(", ")}.` : undefined,
  };
  const next: PipelineSnapshot = {
    performanceRows: failedGates.length ? snapshot.performanceRows : mergeById(snapshot.performanceRows, input.result.rows),
    creativeRows: failedGates.length ? snapshot.creativeRows : mergeById(snapshot.creativeRows, input.result.creatives),
    jobs: [completed, ...snapshot.jobs.filter((item) => item.id !== completed.id)].slice(0, 500),
    updatedAt: finishedAt,
  };
  await store.write(next);
  return completed;
}

export function pipelineSlaStatus(job: SyncJob, maxHours = 4) {
  const duration = job.durationMs ?? 0;
  return { withinSla: duration <= maxHours * 60 * 60 * 1000, durationMs: duration, maxDurationMs: maxHours * 60 * 60 * 1000 };
}

export function pipelineHealth(snapshot: PipelineSnapshot) {
  const latest = snapshot.jobs[0];
  const qualityFailures = snapshot.jobs.reduce((count, job) => count + job.quality.filter((gate) => gate.status === "fail").length, 0);
  return {
    status: latest?.status === "failed" ? "failed" as const : qualityFailures > 0 ? "degraded" as const : "healthy" as const,
    latestJob: latest,
    rowCount: snapshot.performanceRows.length,
    creativeCount: snapshot.creativeRows.length,
    qualityFailures,
    sla: latest ? pipelineSlaStatus(latest) : undefined,
  };
}
