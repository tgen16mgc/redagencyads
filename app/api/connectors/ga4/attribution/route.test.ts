import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchGa4DataDrivenAttribution,
  getGoogleConnectorAccessToken,
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
} =
  vi.hoisted(() => ({
    fetchGa4DataDrivenAttribution: vi.fn(),
    getGoogleConnectorAccessToken: vi.fn(),
    recordAutomaticDecisionWorkspaceAcceptanceEvidence: vi.fn(),
  }));
vi.mock("@/lib/ga4-attribution", () => ({ fetchGa4DataDrivenAttribution }));
vi.mock("@/lib/google-connector-auth", () => ({
  getGoogleConnectorAccessToken,
}));
vi.mock("@/lib/decision-workspace-acceptance", () => ({
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
}));

import { POST } from "./route";
import { SessionAuthError } from "@/lib/session";

describe("POST /api/connectors/ga4/attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GA4_PROPERTY_ID = "123456";
    delete process.env.GA4_ACCESS_TOKEN;
    delete process.env.GOOGLE_ADS_ACCESS_TOKEN;
    recordAutomaticDecisionWorkspaceAcceptanceEvidence.mockResolvedValue({
      recorded: false,
      reason: "non_production",
    });
  });

  it("loads GA4 attribution without accepting a caller-selected property", async () => {
    getGoogleConnectorAccessToken.mockResolvedValue("oauth-token");
    fetchGa4DataDrivenAttribution.mockResolvedValue({
      propertyId: "123456",
      reportingAttributionModel: "CROSS_CHANNEL_DATA_DRIVEN",
      conversions: 20,
      revenue: 4000,
      channels: [],
      since: "2026-07-01",
      until: "2026-07-28",
      source: "ga4_data_api",
    });
    const response = await POST(
      new Request("http://localhost/api/connectors/ga4/attribution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId: "999999",
          since: "2026-07-01",
          until: "2026-07-28",
        }),
      }),
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.attribution.propertyId).toBe("123456");
    expect(fetchGa4DataDrivenAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "oauth-token",
        propertyId: "123456",
      }),
    );
    expect(getGoogleConnectorAccessToken).toHaveBeenCalledWith(
      expect.any(Request),
    );
    expect(recordAutomaticDecisionWorkspaceAcceptanceEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        requirementId: "T2.2.3",
        acceptanceMet: true,
        runId: "ga4:123456:2026-07-01:2026-07-28",
      }),
    );
  });

  it("does not expose GA4 data through server credentials alone", async () => {
    process.env.GA4_ACCESS_TOKEN = "server-token";
    getGoogleConnectorAccessToken.mockRejectedValueOnce(
      new SessionAuthError("Google connector session missing."),
    );
    const response = await POST(
      new Request("http://localhost/api/connectors/ga4/attribution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          since: "2026-07-01",
          until: "2026-07-28",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(fetchGa4DataDrivenAttribution).not.toHaveBeenCalled();
  });
});
