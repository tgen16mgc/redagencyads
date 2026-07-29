import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getGoogleAdsWriteContext,
  graphRequest,
  replaceGoogleAdsCampaignDaypartSchedule,
  requireToken,
} = vi.hoisted(() => ({
  getGoogleAdsWriteContext: vi.fn(),
  graphRequest: vi.fn(),
  replaceGoogleAdsCampaignDaypartSchedule: vi.fn(),
  requireToken: vi.fn(),
}));
vi.mock("@/lib/connector-adapters", () => ({
  replaceGoogleAdsCampaignDaypartSchedule,
}));
vi.mock("@/lib/google-ads-auth", () => ({ getGoogleAdsWriteContext }));
vi.mock("@/lib/meta-graph", () => ({ graphRequest }));
vi.mock("@/lib/session", () => ({
  requireToken,
  sessionErrorStatus: () => 400,
}));

import { POST } from "./route";

describe("POST /api/budget/daypart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireToken.mockResolvedValue("meta-token");
    graphRequest.mockResolvedValue({});
  });

  it("previews a schedule without writing", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/daypart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "meta",
          targetId: "adset-1",
          rules: [{ day: 1, startHour: 9, endHour: 18, bidMultiplier: 1.1 }],
          apply: false,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).audit.status).toBe("planned");
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("writes Meta schedules in minute units", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/daypart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "meta",
          targetId: "adset-1",
          rules: [{ day: 1, startHour: 9, endHour: 18, bidMultiplier: 1.1 }],
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const call = graphRequest.mock.calls[0][0];
    expect(JSON.parse(call.body.get("adset_schedule"))[0]).toMatchObject({
      days: [1],
      start_minute: 540,
      end_minute: 1080,
      bid_adjustment: 1.1,
    });
  });

  it("refuses TikTok writes without an owned Ads API connector", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/daypart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "tiktok",
          targetId: "adset-1",
          rules: [{ day: 1, startHour: 9, endHour: 18, bidMultiplier: 1.1 }],
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(501);
  });

  it("replaces a Google Ads campaign daypart schedule", async () => {
    getGoogleAdsWriteContext.mockResolvedValue({
      accessToken: "google",
      customerId: "123",
      developerToken: "developer",
    });
    replaceGoogleAdsCampaignDaypartSchedule.mockResolvedValue({
      removed: 0,
      created: 1,
    });
    const response = await POST(
      new Request("http://localhost/api/budget/daypart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "google_ads",
          targetId: "campaigns/1",
          rules: [{ day: 1, startHour: 9, endHour: 18, bidMultiplier: 1.1 }],
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(replaceGoogleAdsCampaignDaypartSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: "campaigns/1" }),
    );
  });
});
