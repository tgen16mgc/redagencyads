import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  storeRead,
  deliver,
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
} = vi.hoisted(() => ({
  storeRead: vi.fn(),
  deliver: vi.fn(),
  recordAutomaticDecisionWorkspaceAcceptanceEvidence: vi.fn(),
}));
vi.mock("@/lib/data-pipeline", () => ({ getDefaultPipelineStore: () => ({ read: storeRead }) }));
vi.mock("@/lib/budget-automation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/budget-automation")>("@/lib/budget-automation");
  return { ...actual, deliverPacingAlert: deliver };
});
vi.mock("@/lib/decision-workspace-acceptance", () => ({
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
}));

import { GET } from "./route";

describe("daily budget pacing alert cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("BUDGET_ALERT_TOTAL_BUDGET", "1000");
    storeRead.mockResolvedValue({ performanceRows: [], creativeRows: [], jobs: [] });
    deliver.mockResolvedValue([{ channel: "slack", ok: true, status: 200 }]);
    recordAutomaticDecisionWorkspaceAcceptanceEvidence.mockResolvedValue({
      recorded: false,
      reason: "non_production",
    });
  });

  it("skips when no budget is configured", async () => {
    vi.stubEnv("BUDGET_ALERT_TOTAL_BUDGET", "");
    const response = await GET(new Request("http://localhost/api/cron/budget-alerts/daily", { headers: { authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("skipped");
  });

  it("delivers an alert when owned spend projects outside the guardrail", async () => {
    const today = new Date().toISOString().slice(0, 10);
    storeRead.mockResolvedValue({ performanceRows: [{ authority: "owned_performance", date: today, spend: 500, id: "row" }], creativeRows: [], jobs: [] });
    const response = await GET(new Request("http://localhost/api/cron/budget-alerts/daily", { headers: { authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("alerted");
    expect(deliver).toHaveBeenCalledOnce();
    expect(recordAutomaticDecisionWorkspaceAcceptanceEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        requirementId: "T4.1.2",
        acceptanceMet: true,
      }),
    );
  });

  it("does not claim an alert was delivered when no webhook is configured", async () => {
    const today = new Date().toISOString().slice(0, 10);
    storeRead.mockResolvedValue({ performanceRows: [{ authority: "owned_performance", date: today, spend: 500, id: "row" }], creativeRows: [], jobs: [] });
    deliver.mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/api/cron/budget-alerts/daily", { headers: { authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(503);
    expect((await response.json()).status).toBe("delivery_unconfigured");
  });

  it("reports failed delivery when every configured channel rejects the alert", async () => {
    const today = new Date().toISOString().slice(0, 10);
    storeRead.mockResolvedValue({ performanceRows: [{ authority: "owned_performance", date: today, spend: 500, id: "row" }], creativeRows: [], jobs: [] });
    deliver.mockResolvedValue([{ channel: "slack", ok: false, status: 500 }]);
    const response = await GET(new Request("http://localhost/api/cron/budget-alerts/daily", { headers: { authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(502);
    expect((await response.json()).status).toBe("delivery_failed");
  });
});
