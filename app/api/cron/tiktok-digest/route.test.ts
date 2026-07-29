import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildTikTokDailyDigest,
  deliverTikTokDigest,
  recordTikTokDigestDelivery,
} = vi.hoisted(() => ({
  buildTikTokDailyDigest: vi.fn(),
  deliverTikTokDigest: vi.fn(),
  recordTikTokDigestDelivery: vi.fn(),
}));
vi.mock("@/lib/tiktok-watchlist", () => ({
  buildTikTokDailyDigest,
  deliverTikTokDigest,
  recordTikTokDigestDelivery,
}));

import { GET } from "./route";

describe("TikTok digest cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    process.env.TIKTOK_DIGEST_REGION = "VN";
    buildTikTokDailyDigest.mockResolvedValue({
      findings: [],
      totalNewCreatives: 0,
      generatedForLocalHour: 8,
      deliveryTimezone: "Asia/Ho_Chi_Minh",
      generatedAt: "2026-07-29T01:00:00.000Z",
    });
    deliverTikTokDigest.mockResolvedValue({
      text: "digest",
      deliveries: [{ channel: "slack", ok: true, status: 200 }],
    });
    recordTikTokDigestDelivery.mockResolvedValue({
      deliveredAt: "2026-07-29T01:00:01.000Z",
      deliveredForLocalHour: 8,
      deliveryTimezone: "Asia/Ho_Chi_Minh",
      acceptanceMet: true,
    });
  });

  it("requires the configured cron secret", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/tiktok-digest"),
    );
    expect(response.status).toBe(401);
    expect(buildTikTokDailyDigest).not.toHaveBeenCalled();
  });

  it("builds and delivers the 08:00 local digest", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/tiktok-digest", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("delivered");
    expect(buildTikTokDailyDigest).toHaveBeenCalledWith({ region: "VN" });
    expect(deliverTikTokDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        digest: expect.objectContaining({ generatedForLocalHour: 8 }),
      }),
    );
    expect(recordTikTokDigestDelivery).toHaveBeenCalledWith({
      timeZone: "Asia/Ho_Chi_Minh",
      deliveredChannels: ["slack"],
    });
    expect(body.acceptance).toMatchObject({
      deliveredForLocalHour: 8,
      acceptanceMet: true,
    });
  });

  it("fails closed when no delivery channel is configured", async () => {
    deliverTikTokDigest.mockResolvedValue({ text: "digest", deliveries: [] });
    const response = await GET(
      new Request("http://localhost/api/cron/tiktok-digest", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("webhook");
  });

  it("reports a gateway failure when every configured delivery fails", async () => {
    deliverTikTokDigest.mockResolvedValue({
      text: "digest",
      deliveries: [{ channel: "slack", ok: false, status: 500 }],
    });
    const response = await GET(
      new Request("http://localhost/api/cron/tiktok-digest", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(response.status).toBe(502);
  });
});
