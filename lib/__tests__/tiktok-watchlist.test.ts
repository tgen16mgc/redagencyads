import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  advertiserCoverage,
  buildTikTokDailyDigest,
  readTikTokWatchlist,
  recordTikTokDigestDelivery,
  saveTikTokWatchlist,
  scoreCpaCorrelation,
} from "@/lib/tiktok-watchlist";

let directory = "";
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  delete process.env.TIKTOK_WATCHLIST_PATH;
  delete process.env.TIKTOK_DIGEST_TIMEZONE;
  directory = "";
});

describe("TikTok watchlist acceptance gates", () => {
  it("persists at most 50 handles and detects new daily creatives", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "watchlist-"));
    process.env.TIKTOK_WATCHLIST_PATH = path.join(directory, "watchlist.json");
    await saveTikTokWatchlist(
      Array.from({ length: 60 }, (_, index) => `brand-${index}`),
    );
    expect((await readTikTokWatchlist()).handles).toHaveLength(50);
    const digest = await buildTikTokDailyDigest({
      now: new Date("2026-07-29T01:00:00.000Z"),
      fetcher: async ({ query }) => ({
        rows: [{ id: `${query}-creative` }],
        warnings: [],
        actorId: "test",
        pulledAt: new Date().toISOString(),
      }),
    });
    expect(digest.totalNewCreatives).toBe(50);
    expect(digest.generatedForLocalHour).toBe(8);
    expect(digest.deliveryTimezone).toBe("Asia/Ho_Chi_Minh");
    expect((await readTikTokWatchlist()).lastDigestAt).toBeUndefined();
    expect(
      (
        await recordTikTokDigestDelivery({
          deliveredAt: new Date("2026-07-29T01:00:00.000Z"),
        })
      ).acceptanceMet,
    ).toBe(true);
    expect(await readTikTokWatchlist()).toMatchObject({
      lastDigestAt: "2026-07-29T01:00:00.000Z",
      lastDigestDelivery: {
        deliveredAt: "2026-07-29T01:00:00.000Z",
        deliveredForLocalHour: 8,
        deliveredForLocalTime: "08:00",
        deliveryTimezone: "Asia/Ho_Chi_Minh",
        deliveredChannels: [],
        certificationEnvironment: "unspecified",
        acceptanceMet: true,
      },
    });
  });

  it("fetches watchlist handles with bounded concurrency", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "watchlist-concurrency-"));
    process.env.TIKTOK_WATCHLIST_PATH = path.join(directory, "watchlist.json");
    await saveTikTokWatchlist(
      Array.from({ length: 12 }, (_, index) => `brand-${index}`),
    );
    let active = 0;
    let peak = 0;
    const digest = await buildTikTokDailyDigest({
      fetcher: async ({ query }) => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        return {
          rows: [{ id: `${query}-creative` }],
          warnings: [],
          actorId: "test",
          pulledAt: new Date().toISOString(),
        };
      },
    });
    expect(digest.findings).toHaveLength(12);
    expect(peak).toBeLessThanOrEqual(5);
  });

  it("reports the actual delivery hour in the configured timezone", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "watchlist-timezone-"));
    process.env.TIKTOK_WATCHLIST_PATH = path.join(directory, "watchlist.json");
    process.env.TIKTOK_DIGEST_TIMEZONE = "America/New_York";
    const digest = await buildTikTokDailyDigest({
      now: new Date("2026-07-29T13:00:00.000Z"),
      fetcher: async () => ({
        rows: [],
        warnings: [],
        actorId: "test",
        pulledAt: new Date().toISOString(),
      }),
    });
    expect(digest.generatedForLocalHour).toBe(9);
    expect(digest.deliveryTimezone).toBe("America/New_York");
    expect(
      (
        await recordTikTokDigestDelivery({
          deliveredAt: new Date("2026-07-29T13:00:00.000Z"),
          timeZone: "America/New_York",
        })
      ).acceptanceMet,
    ).toBe(false);
  });

  it("does not treat a delivery after 08:00 as on time", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "watchlist-minute-"));
    process.env.TIKTOK_WATCHLIST_PATH = path.join(directory, "watchlist.json");

    const result = await recordTikTokDigestDelivery({
      deliveredAt: new Date("2026-07-29T01:01:00.000Z"),
      timeZone: "Asia/Ho_Chi_Minh",
      deliveredChannels: ["slack"],
    });

    expect(result).toMatchObject({
      deliveredForLocalHour: 8,
      deliveredForLocalTime: "08:01",
      acceptanceMet: false,
    });
  });

  it("measures advertiser coverage and score-to-CPA correlation", () => {
    expect(
      advertiserCoverage(
        Array.from({ length: 100 }, (_, index) => ({
          handle: String(index),
          matched: index < 95,
        })),
      ).acceptanceMet,
    ).toBe(true);
    expect(
      scoreCpaCorrelation([
        { score: 20, cpa: 100, observedAt: "2026-07-01T00:00:00.000Z" },
        { score: 40, cpa: 80, observedAt: "2026-07-10T00:00:00.000Z" },
        { score: 60, cpa: 60, observedAt: "2026-07-20T00:00:00.000Z" },
        { score: 80, cpa: 40, observedAt: "2026-07-30T00:00:00.000Z" },
      ]).acceptanceMet,
    ).toBe(true);
  });

  it("does not accept score correlation without a complete 30-day window", () => {
    const undated = scoreCpaCorrelation([
      { score: 20, cpa: 100 },
      { score: 40, cpa: 80 },
      { score: 60, cpa: 60 },
    ]);
    const shortWindow = scoreCpaCorrelation([
      { score: 20, cpa: 100, observedAt: "2026-07-01T00:00:00.000Z" },
      { score: 40, cpa: 80, observedAt: "2026-07-10T00:00:00.000Z" },
      { score: 60, cpa: 60, observedAt: "2026-07-29T00:00:00.000Z" },
    ]);

    expect(undated).toMatchObject({
      dateEvidenceComplete: false,
      observationWindowDays: 0,
      acceptanceMet: false,
    });
    expect(shortWindow).toMatchObject({
      dateEvidenceComplete: true,
      observationWindowDays: 29,
      acceptanceMet: false,
    });
  });
});
