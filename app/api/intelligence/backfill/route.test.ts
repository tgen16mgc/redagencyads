import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireConnectorSessionAccessToken, runConnectorBackfill } = vi.hoisted(
  () => ({
    requireConnectorSessionAccessToken: vi.fn(),
    runConnectorBackfill: vi.fn(),
  }),
);
vi.mock("@/lib/interactive-connector-auth", () => ({
  requireConnectorSessionAccessToken,
}));
vi.mock("@/lib/sync-runner", () => ({ runConnectorBackfill }));

import { POST } from "./route";
import { SessionAuthError } from "@/lib/session";

describe("POST /api/intelligence/backfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    requireConnectorSessionAccessToken.mockResolvedValue("oauth-token");
    runConnectorBackfill.mockResolvedValue({
      platform: "linkedin",
      windows: [],
      succeeded: 0,
      failed: 0,
      status: "succeeded",
    });
  });

  it("plans the requested 13-month source window", async () => {
    const response = await POST(new Request("http://localhost/api/intelligence/backfill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: "linkedin", months: 13, execute: false }) }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.windows).toHaveLength(13);
    expect(json.status).toBe("planned");
    expect(requireConnectorSessionAccessToken).not.toHaveBeenCalled();
  });

  it("executes with the matching interactive OAuth session", async () => {
    const response = await POST(new Request("http://localhost/api/intelligence/backfill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: "linkedin", months: 1, execute: true }) }));

    expect(response.status).toBe(200);
    expect(requireConnectorSessionAccessToken).toHaveBeenCalledWith(
      expect.any(Request),
      "linkedin",
    );
    expect(runConnectorBackfill).toHaveBeenCalledWith({
      platform: "linkedin",
      accessToken: "oauth-token",
      months: 1,
    });
  });

  it("does not execute with a server token when the browser session is absent", async () => {
    process.env.LINKEDIN_ACCESS_TOKEN = "server-token";
    requireConnectorSessionAccessToken.mockRejectedValueOnce(
      new SessionAuthError("LinkedIn connector session missing."),
    );
    const response = await POST(new Request("http://localhost/api/intelligence/backfill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: "linkedin", months: 1, execute: true }) }));

    expect(response.status).toBe(401);
    expect(runConnectorBackfill).not.toHaveBeenCalled();
  });
});
