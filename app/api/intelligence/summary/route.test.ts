import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchGa4DataDrivenAttribution, getGoogleConnectorAccessToken } =
  vi.hoisted(() => ({
    fetchGa4DataDrivenAttribution: vi.fn(),
    getGoogleConnectorAccessToken: vi.fn(),
  }));
vi.mock("@/lib/ga4-attribution", () => ({ fetchGa4DataDrivenAttribution }));
vi.mock("@/lib/google-connector-auth", () => ({
  getGoogleConnectorAccessToken,
}));
import { POST } from "./route";
import { buildSampleReport } from "@/lib/sample-report";

describe("POST /api/intelligence/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.GA4_ACCESS_TOKEN;
  });

  it("returns canonical owned totals and public-source boundaries", async () => {
    const response = await POST(
      new Request("http://localhost/api/intelligence/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ metaReport: buildSampleReport() }),
      }),
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.snapshot.schemaVersion).toBe("1.0");
    expect(json.snapshot.platforms[0].authority).toBe("owned_performance");
    expect(json.snapshot.totals.spend).toBeGreaterThan(0);
  });

  it("uses OAuth-authorized GA4 totals for data-driven attribution", async () => {
    process.env.GA4_PROPERTY_ID = "123456";
    getGoogleConnectorAccessToken.mockResolvedValue("oauth-token");
    fetchGa4DataDrivenAttribution.mockResolvedValue({
      propertyId: "123456",
      reportingAttributionModel: "CROSS_CHANNEL_DATA_DRIVEN",
      conversions: 42,
      revenue: 8400,
      channels: [],
      since: "2026-06-01",
      until: "2026-06-30",
      source: "ga4_data_api",
    });
    const response = await POST(
      new Request("http://localhost/api/intelligence/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metaReport: buildSampleReport(),
          attributionModel: "data_driven",
          dataDrivenAttributionAvailable: false,
        }),
      }),
    );
    const json = await response.json();
    expect(json.snapshot.attribution).toMatchObject({
      effectiveModel: "data_driven",
      source: "ga4_data_api",
      attributedConversions: 42,
      attributedRevenue: 8400,
    });
    expect(fetchGa4DataDrivenAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "oauth-token",
        propertyId: "123456",
      }),
    );
  });

  it("falls back to last click instead of exposing GA4 through a server token", async () => {
    process.env.GA4_PROPERTY_ID = "123456";
    process.env.GA4_ACCESS_TOKEN = "server-token";
    getGoogleConnectorAccessToken.mockRejectedValueOnce(
      new Error("Google connector session missing."),
    );
    const response = await POST(
      new Request("http://localhost/api/intelligence/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metaReport: buildSampleReport(),
          attributionModel: "data_driven",
        }),
      }),
    );
    const json = await response.json();

    expect(json.snapshot.attribution).toMatchObject({
      effectiveModel: "last_click",
      source: "canonical_rows",
    });
    expect(json.snapshot.attribution.warning).toContain(
      "Google connector session missing",
    );
    expect(fetchGa4DataDrivenAttribution).not.toHaveBeenCalled();
  });

  it("ignores caller availability claims and falls back to last click when GA4 is unavailable", async () => {
    const response = await POST(
      new Request("http://localhost/api/intelligence/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metaReport: buildSampleReport(),
          attributionModel: "data_driven",
          dataDrivenAttributionAvailable: true,
        }),
      }),
    );
    const json = await response.json();
    expect(json.snapshot.attribution).toMatchObject({
      effectiveModel: "last_click",
      source: "canonical_rows",
    });
    expect(json.snapshot.attribution.warning).toContain(
      "GA4_PROPERTY_ID is not configured",
    );
    expect(fetchGa4DataDrivenAttribution).not.toHaveBeenCalled();
  });
});
