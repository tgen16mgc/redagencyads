import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveServerConnectorAccessToken, runConnectorBackfill } = vi.hoisted(() => ({
  resolveServerConnectorAccessToken: vi.fn(),
  runConnectorBackfill: vi.fn(),
}));
vi.mock("@/lib/sync-runner", () => ({ runConnectorBackfill }));
vi.mock("@/lib/server-connector-auth", () => ({
  resolveServerConnectorAccessToken,
}));

import { POST } from "./route";

describe("connector backfill cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    resolveServerConnectorAccessToken.mockResolvedValue("youtube-token");
    runConnectorBackfill.mockResolvedValue({
      platform: "youtube",
      windows: [],
      jobs: [],
      succeeded: 13,
      failed: 0,
      status: "succeeded",
    });
  });

  it("requires cron authentication", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/connectors/backfill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform: "youtube", months: 13 }),
      }),
    );
    expect(response.status).toBe(401);
    expect(runConnectorBackfill).not.toHaveBeenCalled();
  });

  it("runs an idempotent server-token backfill", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/connectors/backfill", {
        method: "POST",
        headers: {
          authorization: "Bearer cron-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ platform: "youtube", months: 13 }),
      }),
    );
    expect(response.status).toBe(200);
    expect(resolveServerConnectorAccessToken).toHaveBeenCalledWith({
      platform: "youtube",
    });
    expect(runConnectorBackfill).toHaveBeenCalledWith({
      platform: "youtube",
      accessToken: "youtube-token",
      months: 13,
    });
  });
});
