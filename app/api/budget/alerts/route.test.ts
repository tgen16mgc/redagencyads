import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deliverPacingAlert,
  requireToken,
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
} = vi.hoisted(() => ({
  deliverPacingAlert: vi.fn(),
  requireToken: vi.fn(),
  recordAutomaticDecisionWorkspaceAcceptanceEvidence: vi.fn(),
}));
vi.mock("@/lib/budget-automation", () => ({ deliverPacingAlert }));
vi.mock("@/lib/session", () => ({
  SessionAuthError: class SessionAuthError extends Error {},
  requireToken,
  sessionErrorStatus: (error: unknown) =>
    error instanceof Error && error.message.includes("session") ? 401 : 400,
}));
vi.mock("@/lib/decision-workspace-acceptance", () => ({
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
}));

import { POST } from "./route";

describe("POST /api/budget/alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BUDGET_ALERT_SLACK_WEBHOOK;
    delete process.env.BUDGET_ALERT_EMAIL_WEBHOOK;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.EMAIL_WEBHOOK_URL;
    requireToken.mockResolvedValue("meta-token");
    deliverPacingAlert.mockResolvedValue([
      { channel: "slack", ok: true, status: 200 },
    ]);
    recordAutomaticDecisionWorkspaceAcceptanceEvidence.mockResolvedValue({
      recorded: false,
      reason: "non_production",
    });
  });

  it("delivers only to server-configured destinations", async () => {
    process.env.BUDGET_ALERT_SLACK_WEBHOOK = "https://hooks.slack.test/owned";
    const response = await POST(
      new Request("http://localhost/api/budget/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Pacing alert" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(deliverPacingAlert).toHaveBeenCalledWith({
      message: "Pacing alert",
      slackWebhook: "https://hooks.slack.test/owned",
      emailWebhook: undefined,
    });
    expect(recordAutomaticDecisionWorkspaceAcceptanceEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        requirementId: "T4.1.2",
        acceptanceMet: true,
      }),
    );
  });

  it("rejects caller-selected webhook destinations", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Pacing alert",
          slackWebhook: "http://169.254.169.254/latest/meta-data",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(deliverPacingAlert).not.toHaveBeenCalled();
  });

  it("requires an authenticated workspace session", async () => {
    requireToken.mockRejectedValueOnce(
      new Error("Meta access token session missing."),
    );
    const response = await POST(
      new Request("http://localhost/api/budget/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Pacing alert" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(deliverPacingAlert).not.toHaveBeenCalled();
  });

  it("reports missing configured delivery channels", async () => {
    deliverPacingAlert.mockResolvedValueOnce([]);
    const response = await POST(
      new Request("http://localhost/api/budget/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Pacing alert" }),
      }),
    );

    expect(response.status).toBe(503);
  });
});
