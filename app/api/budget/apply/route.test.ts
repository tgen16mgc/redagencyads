import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptConnectorToken } from "@/lib/connector-oauth";

const {
  cookieStore,
  cookies,
  graphRequest,
  requireToken,
  updateGoogleAdsCampaignBudget,
} = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() },
  cookies: vi.fn(),
  graphRequest: vi.fn(),
  requireToken: vi.fn(),
  updateGoogleAdsCampaignBudget: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/connector-adapters", () => ({ updateGoogleAdsCampaignBudget }));
vi.mock("@/lib/meta-graph", () => ({ graphRequest }));
vi.mock("@/lib/session", () => ({
  SessionAuthError: class SessionAuthError extends Error {},
  requireToken,
  sessionErrorStatus: (error: unknown) =>
    error instanceof Error && error.message.includes("session") ? 401 : 400,
}));

import { POST } from "./route";

describe("POST /api/budget/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GOOGLE_ADS_ACCESS_TOKEN;
    delete process.env.GOOGLE_ADS_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    process.env.SESSION_SECRET = "budget-route-session-secret";
    cookieStore.get.mockReturnValue(undefined);
    cookies.mockResolvedValue(cookieStore);
    requireToken.mockResolvedValue("meta-token");
    graphRequest.mockResolvedValue({ success: true });
    updateGoogleAdsCampaignBudget.mockResolvedValue({
      resourceName: "customers/123/campaignBudgets/456",
    });
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("records a guardrailed dry run without issuing a platform write", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "meta",
          targetId: "campaign-1",
          budget: 110,
          currentBudget: 100,
          apply: false,
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.audit).toMatchObject({
      action: "budget_change",
      target: "campaign-1",
      status: "planned",
    });
    expect(body.protection.allowed).toBe(true);
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("freezes and queues changes for automatic resume after learning", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "meta",
          targetId: "campaign-1",
          budget: 105,
          currentBudget: 100,
          learningStatus: "LEARNING",
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.protection.frozen).toBe(true);
    expect(body.audit).toMatchObject({
      status: "deferred",
      resumeWhen: "learning_exit",
    });
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("requires an authenticated Meta session before queuing a deferred change", async () => {
    requireToken.mockRejectedValueOnce(
      new Error("Meta access token session missing."),
    );
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "meta",
          targetId: "campaign-1",
          budget: 105,
          currentBudget: 100,
          learningStatus: "LEARNING",
          apply: true,
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).audit).toBeUndefined();
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("applies an approved Meta daily budget in minor currency units", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "meta",
          targetId: "campaign-1",
          budget: 115.25,
          currentBudget: 100,
          learningStatus: "NOT_LEARNING",
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const call = graphRequest.mock.calls[0][0];
    expect(call).toMatchObject({
      path: "/campaign-1",
      method: "POST",
      token: "meta-token",
    });
    expect(call.body.get("daily_budget")).toBe("11525");
  });

  it("applies an approved Google Ads campaign budget through the owned connector", async () => {
    process.env.GOOGLE_ADS_CUSTOMER_ID = "123";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer";
    cookieStore.get.mockImplementation((name: string) =>
      name === "connector_token_google"
        ? {
            value: encryptConnectorToken({
              provider: "google",
              accessToken: "google-token",
            }),
          }
        : undefined,
    );
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "google_ads",
          targetId: "campaignBudgets/456",
          budget: 115.25,
          currentBudget: 100,
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(updateGoogleAdsCampaignBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "google-token",
        customerId: "123",
        developerToken: "developer",
        campaignBudgetId: "campaignBudgets/456",
        amount: 115.25,
      }),
    );
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("does not authorize an interactive Google write with server credentials alone", async () => {
    process.env.GOOGLE_ADS_ACCESS_TOKEN = "server-google-token";
    process.env.GOOGLE_ADS_CUSTOMER_ID = "123";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer";
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "google_ads",
          targetId: "campaignBudgets/456",
          budget: 115.25,
          currentBudget: 100,
          apply: true,
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(updateGoogleAdsCampaignBudget).not.toHaveBeenCalled();
  });

  it("queues Google changes for automatic resume when campaign identity is supplied", async () => {
    process.env.GOOGLE_ADS_CUSTOMER_ID = "123";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer";
    cookieStore.get.mockImplementation((name: string) =>
      name === "connector_token_google"
        ? {
            value: encryptConnectorToken({
              provider: "google",
              accessToken: "google-token",
            }),
          }
        : undefined,
    );
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "google_ads",
          targetId: "campaignBudgets/456",
          campaignId: "campaigns/123",
          budget: 105,
          currentBudget: 100,
          learningStatus: "LEARNING",
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(202);
    expect((await response.json()).audit).toMatchObject({
      status: "deferred",
      target: "campaignBudgets/456",
      details: { campaignId: "campaigns/123" },
    });
    expect(updateGoogleAdsCampaignBudget).not.toHaveBeenCalled();
  });

  it("requires a Google campaign ID before queuing a learning-phase budget", async () => {
    process.env.GOOGLE_ADS_CUSTOMER_ID = "123";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer";
    cookieStore.get.mockImplementation((name: string) =>
      name === "connector_token_google"
        ? {
            value: encryptConnectorToken({
              provider: "google",
              accessToken: "google-token",
            }),
          }
        : undefined,
    );
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "google_ads",
          targetId: "campaignBudgets/456",
          budget: 105,
          currentBudget: 100,
          learningStatus: "LEARNING",
          apply: true,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("campaignId");
    expect(updateGoogleAdsCampaignBudget).not.toHaveBeenCalled();
  });

  it("refuses TikTok writes until an owned-account connector supports them", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "tiktok",
          targetId: "campaign-1",
          budget: 110,
          currentBudget: 100,
          apply: true,
        }),
      }),
    );
    expect(response.status).toBe(501);
    expect(graphRequest).not.toHaveBeenCalled();
  });
});
