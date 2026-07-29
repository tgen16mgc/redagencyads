import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchConnectorRows, requireConnectorSessionAccessToken } = vi.hoisted(
  () => ({
    fetchConnectorRows: vi.fn(),
    requireConnectorSessionAccessToken: vi.fn(),
  }),
);
vi.mock("@/lib/connector-adapters", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/connector-adapters")
  >("@/lib/connector-adapters");
  return { ...actual, fetchConnectorRows };
});
vi.mock("@/lib/interactive-connector-auth", () => ({
  requireConnectorSessionAccessToken,
}));

import { POST } from "./route";
import { SessionAuthError } from "@/lib/session";

describe("POST /api/intelligence/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GOOGLE_ADS_ACCESS_TOKEN;
    requireConnectorSessionAccessToken.mockResolvedValue("oauth-token");
  });

  it("authenticates and ingests operator-supplied connector rows", async () => {
    const response = await POST(new Request("http://localhost/api/intelligence/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: "google_ads", mode: "full", rows: [{ date: "2026-07-01", campaign: { id: "c1" }, metrics: { costMicros: 1000000, impressions: 100, clicks: 5, conversions: 1 } }] }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).job.status).toBe("succeeded");
    expect(requireConnectorSessionAccessToken).toHaveBeenCalledWith(
      expect.any(Request),
      "google",
    );
  });

  it("uses only the authenticated connector token for external fetches", async () => {
    fetchConnectorRows.mockResolvedValue([]);
    const response = await POST(new Request("http://localhost/api/intelligence/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: "youtube", mode: "incremental" }) }));

    expect(response.status).toBe(200);
    expect(fetchConnectorRows).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "youtube", accessToken: "oauth-token" }),
    );
  });

  it("does not authorize interactive sync or row ingestion with server credentials alone", async () => {
    process.env.GOOGLE_ADS_ACCESS_TOKEN = "server-token";
    requireConnectorSessionAccessToken.mockRejectedValueOnce(
      new SessionAuthError("Google connector session missing."),
    );
    const response = await POST(new Request("http://localhost/api/intelligence/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: "google_ads", mode: "full", rows: [{ campaign: { id: "spoofed" } }] }) }));

    expect(response.status).toBe(401);
    expect(fetchConnectorRows).not.toHaveBeenCalled();
  });
});
