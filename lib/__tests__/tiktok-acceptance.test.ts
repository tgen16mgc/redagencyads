import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildTikTokAcceptanceSnapshot,
  certifyTikTokAcceptanceEvidence,
  readTikTokAcceptanceEvidence,
  recordTikTokAcceptanceEvidence,
} from "@/lib/tiktok-acceptance";
import { recordTikTokDigestDelivery } from "@/lib/tiktok-watchlist";

let directory = "";

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  for (const key of [
    "TIKTOK_ACCEPTANCE_PATH",
    "TIKTOK_WATCHLIST_PATH",
    "TIKTOK_CCL_API_URL",
    "TIKTOK_CCL_ACCESS_TOKEN",
    "CRON_SECRET",
    "TIKTOK_DIGEST_SLACK_WEBHOOK",
    "TIKTOK_ACCEPTANCE_TOKEN",
    "TIKTOK_ACCEPTANCE_ENVIRONMENT",
  ]) {
    delete process.env[key];
  }
  directory = "";
});

async function configureFiles() {
  directory = await mkdtemp(path.join(os.tmpdir(), "tiktok-acceptance-"));
  process.env.TIKTOK_ACCEPTANCE_PATH = path.join(directory, "acceptance.json");
  process.env.TIKTOK_WATCHLIST_PATH = path.join(directory, "watchlist.json");
}

describe("TikTok live acceptance snapshot", () => {
  it("only passes all five gates with explicit production evidence", async () => {
    await configureFiles();
    process.env.TIKTOK_CCL_API_URL = "https://partner.example/tiktok";
    process.env.TIKTOK_CCL_ACCESS_TOKEN = "secret";
    process.env.CRON_SECRET = "cron-secret";
    process.env.TIKTOK_DIGEST_SLACK_WEBHOOK =
      "https://hooks.example/tiktok";
    process.env.TIKTOK_ACCEPTANCE_TOKEN = "acceptance-secret";
    process.env.TIKTOK_ACCEPTANCE_ENVIRONMENT = "production";
    const certification = {
      certifiedAt: "2026-07-29T00:00:00.000Z",
      environment: "production",
      cohortLabel: "release-2026-07-29",
      requestOrigin: "https://decision.example",
      method: "operator_token" as const,
    };

    await recordTikTokAcceptanceEvidence({
      coverage: {
        measuredAt: "2026-07-29T00:00:00.000Z",
        region: "DE",
        queried: 100,
        matched: 95,
        coverage: 0.95,
        acceptanceMet: true,
        officialFeedUsed: true,
        sourceActorIds: ["tiktok-commercial-content-library"],
        certification,
      },
      ingestion: {
        measuredAt: "2026-07-29T00:05:00.000Z",
        actorId: "tiktok-commercial-content-library",
        officialFeedUsed: true,
        pipelineDurationMs: 20_000,
        normalizationDurationMs: 250,
        normalizedWithin15Minutes: true,
        certification,
      },
      deduplication: {
        measuredAt: "2026-07-29T00:10:00.000Z",
        sampleSize: 500,
        expectedUniqueCount: 420,
        predictedUniqueCount: 420,
        precision: 1,
        recall: 1,
        deduplicationAccuracy: 1,
        acceptanceMet: true,
        certification,
      },
      search: {
        measuredAt: "2026-07-29T00:15:00.000Z",
        recordCount: 10_000,
        resultCount: 25,
        durationMs: 42,
        acceptanceMet: true,
        certification,
      },
      scoring: {
        measuredAt: "2026-07-29T00:20:00.000Z",
        sampleSize: 60,
        correlation: -0.72,
        absoluteCorrelation: 0.72,
        dateEvidenceComplete: true,
        observationWindowStart: "2026-06-30T00:00:00.000Z",
        observationWindowEnd: "2026-07-29T00:00:00.000Z",
        observationWindowDays: 30,
        acceptanceMet: true,
        certification,
      },
    });
    await recordTikTokDigestDelivery({
      deliveredAt: new Date("2026-07-29T01:00:00.000Z"),
      timeZone: "Asia/Ho_Chi_Minh",
      deliveredChannels: ["slack"],
    });

    const snapshot = await buildTikTokAcceptanceSnapshot();

    expect(snapshot.passedCount).toBe(5);
    expect(snapshot.gates.every((gate) => gate.state === "passed")).toBe(true);
  });

  it("reports credential and delivery blockers without inventing evidence", async () => {
    await configureFiles();

    const snapshot = await buildTikTokAcceptanceSnapshot();

    expect(snapshot.passedCount).toBe(0);
    expect(snapshot.gates.find((gate) => gate.id === "T1.1.1")?.state).toBe(
      "blocked",
    );
    expect(snapshot.gates.find((gate) => gate.id === "T1.1.4")?.state).toBe(
      "blocked",
    );
    expect(snapshot.gates.find((gate) => gate.id === "T1.1.5")?.state).toBe(
      "blocked",
    );
  });

  it("records evidence only for a valid operator token", async () => {
    await configureFiles();
    process.env.TIKTOK_ACCEPTANCE_TOKEN = "acceptance-secret";
    process.env.TIKTOK_ACCEPTANCE_ENVIRONMENT = "production";
    const patch = {
      search: {
        measuredAt: "2026-07-29T00:00:00.000Z",
        recordCount: 10_000,
        resultCount: 25,
        durationMs: 42,
        acceptanceMet: true,
      },
    };

    expect(
      await certifyTikTokAcceptanceEvidence(
        new Request("https://decision.example/api/tiktok/ads/search"),
        patch,
      ),
    ).toEqual({ recorded: false, reason: "not_requested" });
    expect(
      await certifyTikTokAcceptanceEvidence(
        new Request("https://decision.example/api/tiktok/ads/search", {
          headers: { authorization: "Bearer wrong-secret" },
        }),
        patch,
      ),
    ).toEqual({ recorded: false, reason: "unauthorized" });
    expect(await readTikTokAcceptanceEvidence()).toEqual({});

    const result = await certifyTikTokAcceptanceEvidence(
      new Request("https://decision.example/api/tiktok/ads/search", {
        headers: {
          authorization: "Bearer acceptance-secret",
          "x-acceptance-cohort": "release-2026-07-29",
        },
      }),
      patch,
    );

    expect(result).toMatchObject({
      recorded: true,
      reason: "recorded",
      certification: {
        environment: "production",
        cohortLabel: "release-2026-07-29",
        requestOrigin: "https://decision.example",
        method: "operator_token",
      },
    });
    expect((await readTikTokAcceptanceEvidence()).search).toMatchObject({
      recordCount: 10_000,
      certification: {
        environment: "production",
        cohortLabel: "release-2026-07-29",
      },
    });
  });
});
