import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchGoogleAdsCampaignLearningState,
  getGoogleAdsServerWriteContext,
  graphRequest,
  processDeferredBudgetActions,
  updateGoogleAdsCampaignBudget,
} = vi.hoisted(() => ({
  fetchGoogleAdsCampaignLearningState: vi.fn(),
  getGoogleAdsServerWriteContext: vi.fn(),
  graphRequest: vi.fn(),
  processDeferredBudgetActions: vi.fn(),
  updateGoogleAdsCampaignBudget: vi.fn(),
}));
vi.mock("@/lib/meta-graph", () => ({ graphRequest }));
vi.mock("@/lib/action-audit", () => ({ processDeferredBudgetActions }));
vi.mock("@/lib/google-ads-auth", () => ({ getGoogleAdsServerWriteContext }));
vi.mock("@/lib/connector-adapters", () => ({
  fetchGoogleAdsCampaignLearningState,
  updateGoogleAdsCampaignBudget,
}));

import { GET } from "./route";

describe("GET /api/cron/budget-actions/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_SYSTEM_ACCESS_TOKEN = "system-token";
    process.env.CRON_SECRET = "cron-secret";
    getGoogleAdsServerWriteContext.mockResolvedValue({
      accessToken: "server-google-token",
      customerId: "123",
      developerToken: "developer",
    });
    processDeferredBudgetActions.mockResolvedValue({ processed: [], deferredRemaining: 0 });
  });

  it("requires the cron secret", async () => {
    expect((await GET(new Request("http://localhost/api/cron/budget-actions/resume"))).status).toBe(401);
  });

  it("provides Meta learning inspection and budget-apply operations to the resume processor", async () => {
    const response = await GET(new Request("http://localhost/api/cron/budget-actions/resume", { headers: { authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(200);
    const operations = processDeferredBudgetActions.mock.calls[0][0];
    graphRequest.mockResolvedValueOnce({ learning_stage_info: { status: "NOT_LEARNING" } }).mockResolvedValueOnce({ success: true });
    const action = {
      entryId: "action-1",
      platform: "meta",
      targetId: "campaign-1",
      budget: 125.25,
    };
    await expect(operations.getLearningStatus(action)).resolves.toBe("NOT_LEARNING");
    await operations.applyBudget(action);
    expect(graphRequest.mock.calls[1][0]).toMatchObject({ path: "/campaign-1", method: "POST", token: "system-token" });
    expect(graphRequest.mock.calls[1][0].body.get("daily_budget")).toBe("12525");
  });

  it("provides Google learning inspection and server-token budget writes", async () => {
    fetchGoogleAdsCampaignLearningState.mockResolvedValue({
      campaignId: "123",
      campaignBudgetId: "customers/123/campaignBudgets/456",
      status: "ELIGIBLE",
    });
    const response = await GET(new Request("http://localhost/api/cron/budget-actions/resume", { headers: { authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(200);
    const operations = processDeferredBudgetActions.mock.calls[0][0];
    const action = {
      entryId: "action-2",
      platform: "google_ads",
      targetId: "campaignBudgets/456",
      campaignId: "campaigns/123",
      budget: 140,
    };

    await expect(operations.getLearningStatus(action)).resolves.toBe("ELIGIBLE");
    await operations.applyBudget(action);
    expect(fetchGoogleAdsCampaignLearningState).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "server-google-token",
        campaignId: "campaigns/123",
      }),
    );
    expect(updateGoogleAdsCampaignBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "server-google-token",
        campaignBudgetId: "campaignBudgets/456",
        amount: 140,
      }),
    );
  });

  it("rejects a deferred Google budget that does not belong to the inspected campaign", async () => {
    fetchGoogleAdsCampaignLearningState.mockResolvedValue({
      campaignId: "123",
      campaignBudgetId: "customers/123/campaignBudgets/999",
      status: "ENABLED",
    });
    await GET(new Request("http://localhost/api/cron/budget-actions/resume", { headers: { authorization: "Bearer cron-secret" } }));
    const operations = processDeferredBudgetActions.mock.calls[0][0];

    await expect(
      operations.getLearningStatus({
        entryId: "action-3",
        platform: "google_ads",
        targetId: "campaignBudgets/456",
        campaignId: "campaigns/123",
        budget: 140,
      }),
    ).rejects.toThrow("do not match");
    expect(updateGoogleAdsCampaignBudget).not.toHaveBeenCalled();
  });

  it("fails honestly when neither platform has scheduled write credentials", async () => {
    delete process.env.META_SYSTEM_ACCESS_TOKEN;
    getGoogleAdsServerWriteContext.mockRejectedValue(new Error("missing"));

    const response = await GET(new Request("http://localhost/api/cron/budget-actions/resume", { headers: { authorization: "Bearer cron-secret" } }));

    expect(response.status).toBe(503);
    expect(processDeferredBudgetActions).not.toHaveBeenCalled();
  });
});
