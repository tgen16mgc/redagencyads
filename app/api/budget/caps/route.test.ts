import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getGoogleAdsWriteContext,
  graphRequest,
  pauseGoogleAdsCampaign,
  requireToken,
  updateGoogleAdsCampaignBudget,
} = vi.hoisted(() => ({
  getGoogleAdsWriteContext: vi.fn(),
  graphRequest: vi.fn(),
  pauseGoogleAdsCampaign: vi.fn(),
  requireToken: vi.fn(),
  updateGoogleAdsCampaignBudget: vi.fn(),
}));
vi.mock("@/lib/connector-adapters", () => ({
  pauseGoogleAdsCampaign,
  updateGoogleAdsCampaignBudget,
}));
vi.mock("@/lib/google-ads-auth", () => ({ getGoogleAdsWriteContext }));
vi.mock("@/lib/meta-graph", () => ({ graphRequest }));
vi.mock("@/lib/session", () => ({
  requireToken,
  sessionErrorStatus: () => 400,
}));

import { POST } from "./route";

const campaigns = [
  {
    id: "meta-over",
    platform: "meta",
    spend: 120,
    cap: 100,
    roas: 1.2,
    active: true,
    dailyBudget: 150,
  },
  {
    id: "meta-next",
    platform: "meta",
    spend: 50,
    cap: 100,
    roas: 2.1,
    active: true,
    dailyBudget: 150,
    learningStatus: "NOT_LEARNING",
  },
];

describe("POST /api/budget/caps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireToken.mockResolvedValue("meta-token");
    graphRequest.mockResolvedValue({});
  });

  it("stages the cap and redistribution plan without writes", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/caps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaigns, apply: false }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.plan).toMatchObject({
      stopped: ["meta-over"],
      redistribute: 30,
      nextBestCampaignId: "meta-next",
    });
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("pauses capped Meta campaigns and moves their unspent budget to the next-best campaign", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/caps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaigns, apply: true }),
      }),
    );
    expect(response.status).toBe(200);
    expect(graphRequest).toHaveBeenCalledTimes(2);
    expect(graphRequest.mock.calls[0][0].body.get("status")).toBe("PAUSED");
    expect(graphRequest.mock.calls[1][0].body.get("daily_budget")).toBe(
      "18000",
    );
  });

  it("refuses a partial cross-platform write", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/caps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaigns: [
            { ...campaigns[0], platform: "google_ads" },
            campaigns[1],
          ],
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(501);
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("pauses and redistributes Google Ads campaigns when budget IDs are supplied", async () => {
    getGoogleAdsWriteContext.mockResolvedValue({
      accessToken: "google",
      customerId: "123",
      developerToken: "developer",
    });
    pauseGoogleAdsCampaign.mockResolvedValue({
      resourceName: "customers/123/campaigns/1",
    });
    updateGoogleAdsCampaignBudget.mockResolvedValue({
      resourceName: "customers/123/campaignBudgets/2",
    });
    const googleCampaigns = [
      { ...campaigns[0], id: "campaigns/1", platform: "google_ads" },
      {
        ...campaigns[1],
        id: "campaigns/2",
        platform: "google_ads",
        budgetId: "campaignBudgets/2",
      },
    ];
    const response = await POST(
      new Request("http://localhost/api/budget/caps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaigns: googleCampaigns, apply: true }),
      }),
    );
    expect(response.status).toBe(200);
    expect(pauseGoogleAdsCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: "campaigns/1" }),
    );
    expect(updateGoogleAdsCampaignBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignBudgetId: "campaignBudgets/2",
        amount: 180,
      }),
    );
  });
});
