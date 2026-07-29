import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getGoogleAdsWriteContext,
  graphRequest,
  requireToken,
  updateGoogleAdsCampaignBudget,
} = vi.hoisted(() => ({
  getGoogleAdsWriteContext: vi.fn(),
  graphRequest: vi.fn(),
  requireToken: vi.fn(),
  updateGoogleAdsCampaignBudget: vi.fn(),
}));
vi.mock("@/lib/connector-adapters", () => ({ updateGoogleAdsCampaignBudget }));
vi.mock("@/lib/google-ads-auth", () => ({ getGoogleAdsWriteContext }));
vi.mock("@/lib/meta-graph", () => ({ graphRequest }));
vi.mock("@/lib/session", () => ({
  requireToken,
  sessionErrorStatus: (error: unknown) =>
    error instanceof Error && error.message.includes("session") ? 401 : 400,
}));

import { POST } from "./route";

describe("budget pacing route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireToken.mockResolvedValue("meta-token");
  });

  it("returns a plan and assessment without mutating an account", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/pacing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cadence: "monthly",
          curve: "linear",
          totalBudget: 1000,
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          actualSpend: 400,
          asOfDate: "2026-07-15",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).assessment).toBeTruthy();
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("applies Google Ads pacing through the owned campaign-budget connector", async () => {
    getGoogleAdsWriteContext.mockResolvedValue({
      accessToken: "google",
      customerId: "123",
      developerToken: "developer",
    });
    updateGoogleAdsCampaignBudget.mockResolvedValue({
      resourceName: "customers/123/campaignBudgets/456",
    });
    const response = await POST(
      new Request("http://localhost/api/budget/pacing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cadence: "daily",
          curve: "linear",
          totalBudget: 1000,
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          actualSpend: 400,
          asOfDate: "2026-07-15",
          apply: true,
          platform: "google_ads",
          targetId: "campaign",
          currentDailyBudget: 37.5,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(updateGoogleAdsCampaignBudget).toHaveBeenCalledWith(
      expect.objectContaining({ campaignBudgetId: "campaign" }),
    );
  });

  it("requires a Meta session before deferring a pacing write", async () => {
    requireToken.mockRejectedValueOnce(
      new Error("Meta access token session missing."),
    );
    const response = await POST(
      new Request("http://localhost/api/budget/pacing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cadence: "daily",
          curve: "linear",
          totalBudget: 1000,
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          actualSpend: 400,
          asOfDate: "2026-07-15",
          apply: true,
          platform: "meta",
          targetId: "campaign-1",
          currentDailyBudget: 37.5,
          learningStatus: "LEARNING",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).audit).toBeUndefined();
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("queues Google pacing changes for automatic resume after learning", async () => {
    getGoogleAdsWriteContext.mockResolvedValue({
      accessToken: "google",
      customerId: "123",
      developerToken: "developer",
    });
    const response = await POST(
      new Request("http://localhost/api/budget/pacing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cadence: "daily",
          curve: "linear",
          totalBudget: 1000,
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          actualSpend: 400,
          asOfDate: "2026-07-15",
          apply: true,
          platform: "google_ads",
          targetId: "campaignBudgets/456",
          campaignId: "campaigns/123",
          currentDailyBudget: 37.5,
          learningStatus: "LEARNING",
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect((await response.json()).audit).toMatchObject({
      status: "deferred",
      details: { campaignId: "campaigns/123" },
    });
    expect(updateGoogleAdsCampaignBudget).not.toHaveBeenCalled();
  });
});
