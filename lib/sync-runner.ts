import { enrichConnectorCreativeContentHashes, fetchConnectorRows, normalizeGoogleAdsRows, normalizeLinkedInRows, normalizeYouTubeAnalyticsRows } from "@/lib/connector-adapters";
import { getDefaultPipelineStore, ingestConnectorResult, incrementalWindow, monthlyBackfillWindows, type PipelineStore, type SyncJob, type SyncMode, type SyncWindow } from "@/lib/data-pipeline";
import type { SyncConnectorPlatform } from "@/lib/connectors";
import { resolveServerConnectorAccessToken } from "@/lib/server-connector-auth";

function failedSyncJob(platform: SyncConnectorPlatform, mode: SyncMode, window: SyncWindow, error: unknown): SyncJob {
  const finishedAt = new Date().toISOString();
  return { id: `sync:${platform}:${mode}:${window.since}:${window.until}`, platform, mode, window, status: "failed", startedAt: finishedAt, finishedAt, rowCount: 0, creativeCount: 0, warnings: [], quality: [], error: error instanceof Error ? error.message : "Connector sync failed." };
}

export async function runConnectorSync(input: { platform: SyncConnectorPlatform; accessToken: string; mode: SyncMode; window: SyncWindow; env?: Record<string, string | undefined>; fetchFn?: typeof fetch; store?: PipelineStore }) {
  const raw = await fetchConnectorRows({ platform: input.platform, accessToken: input.accessToken, since: input.window.since, until: input.window.until, env: input.env, fetchFn: input.fetchFn });
  const normalized = input.platform === "google_ads" ? normalizeGoogleAdsRows(raw, input.window.until) : input.platform === "youtube" ? normalizeYouTubeAnalyticsRows(raw, input.window.until) : normalizeLinkedInRows(raw, input.window.until);
  const result = await enrichConnectorCreativeContentHashes({
    result: normalized,
    fetchFn: input.fetchFn,
  });
  return ingestConnectorResult(input.store || getDefaultPipelineStore(), { result, mode: input.mode, window: input.window });
}

export async function runConnectorBackfill(input: { platform: SyncConnectorPlatform; accessToken: string; months?: number; env?: Record<string, string | undefined>; fetchFn?: typeof fetch; store?: PipelineStore; now?: Date }) {
  const windows = monthlyBackfillWindows(input.now || new Date(), input.months || 13);
  const jobs: SyncJob[] = [];
  for (const window of windows) {
    try {
      jobs.push(await runConnectorSync({ platform: input.platform, accessToken: input.accessToken, mode: "backfill", window, env: input.env, fetchFn: input.fetchFn, store: input.store }));
    } catch (error) {
      jobs.push(failedSyncJob(input.platform, "backfill", window, error));
    }
  }
  const succeeded = jobs.filter((job) => job.status === "succeeded").length;
  return { platform: input.platform, windows, jobs, succeeded, failed: jobs.length - succeeded, status: succeeded === jobs.length ? "succeeded" as const : succeeded > 0 ? "partial" as const : "failed" as const };
}

export async function runConfiguredConnectorSync(input: { mode: SyncMode; window?: SyncWindow; env?: Record<string, string | undefined>; fetchFn?: typeof fetch }) {
  const env = input.env || process.env;
  const window = input.window || (input.mode === "backfill" ? monthlyBackfillWindows(new Date(), 1)[0] : incrementalWindow(new Date(), input.mode === "full" ? 7 : 3));
  const jobs: SyncJob[] = [];
  const configuredSources: SyncConnectorPlatform[] = [];
  const sources: SyncConnectorPlatform[] = ["google_ads", "youtube", "linkedin"];
  for (const platform of sources) {
    try {
      const accessToken = await resolveServerConnectorAccessToken({
        platform,
        env,
        fetchFn: input.fetchFn,
      });
      if (!accessToken) continue;
      configuredSources.push(platform);
      jobs.push(await runConnectorSync({ platform, accessToken, mode: input.mode, window, env, fetchFn: input.fetchFn }));
    } catch (error) {
      configuredSources.push(platform);
      jobs.push(failedSyncJob(platform, input.mode, window, error));
    }
  }
  return { window, jobs, configuredSources };
}
