import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchLinkedInB2BBreakdown, requireConnectorSessionAccessToken } =
  vi.hoisted(() => ({
    fetchLinkedInB2BBreakdown: vi.fn(),
    requireConnectorSessionAccessToken: vi.fn(),
  }));
vi.mock("@/lib/connector-adapters", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/connector-adapters")
  >("@/lib/connector-adapters");
  return { ...actual, fetchLinkedInB2BBreakdown };
});
vi.mock("@/lib/interactive-connector-auth", () => ({
  requireConnectorSessionAccessToken,
}));

import { POST } from "./route";
import { SessionAuthError } from "@/lib/session";

describe("POST /api/connectors/linkedin/b2b", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINKEDIN_AD_ACCOUNT_ID = "urn:li:sponsoredAccount:123";
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    requireConnectorSessionAccessToken.mockResolvedValue("oauth-token");
    fetchLinkedInB2BBreakdown.mockResolvedValue({
      companyRows: [],
      jobTitleRows: [],
    });
  });

  it("loads B2B reporting with the LinkedIn browser session", async () => {
    const response = await POST(
      new Request("http://localhost/api/connectors/linkedin/b2b", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetAccounts: ["Acme"] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(requireConnectorSessionAccessToken).toHaveBeenCalledWith(
      expect.any(Request),
      "linkedin",
    );
    expect(fetchLinkedInB2BBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "oauth-token" }),
    );
  });

  it("does not expose LinkedIn reporting through a server token alone", async () => {
    process.env.LINKEDIN_ACCESS_TOKEN = "server-token";
    requireConnectorSessionAccessToken.mockRejectedValueOnce(
      new SessionAuthError("LinkedIn connector session missing."),
    );
    const response = await POST(
      new Request("http://localhost/api/connectors/linkedin/b2b", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    expect(fetchLinkedInB2BBreakdown).not.toHaveBeenCalled();
  });
});
