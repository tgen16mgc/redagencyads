import { describe, expect, it } from "vitest";
import {
  buildBacklogPlatformContracts,
  buildConnectorContracts,
  connectorAccessTokenForPlatform,
  connectorEnvReadiness,
  connectorProviderForPlatform,
} from "@/lib/connectors";

describe("connector readiness contracts", () => {
  it("keeps unconfigured Google and LinkedIn connectors honest", () => {
    const connectors = buildConnectorContracts({
      metaAuthenticated: true,
      apifyConfigured: true,
    });
    expect(connectors.find((item) => item.id === "meta")?.state).toBe(
      "available",
    );
    expect(connectors.find((item) => item.id === "tiktok_public")?.state).toBe(
      "available",
    );
    expect(connectors.find((item) => item.id === "google_ads")?.state).toBe(
      "needs_setup",
    );
    expect(connectors.find((item) => item.id === "linkedin_ads")?.state).toBe(
      "needs_setup",
    );
  });

  it("requires the complete minimum env set for each connector", () => {
    expect(
      connectorEnvReadiness({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
      }).googleAdsConfigured,
    ).toBe(false);
    expect(
      connectorEnvReadiness({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_ADS_DEVELOPER_TOKEN: "dev",
      }).googleAdsConfigured,
    ).toBe(false);
    expect(
      connectorEnvReadiness({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_ADS_DEVELOPER_TOKEN: "dev",
        GOOGLE_ADS_CUSTOMER_ID: "123",
      }).googleAdsConfigured,
    ).toBe(true);
    expect(
      connectorEnvReadiness({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GA4_PROPERTY_ID: "123",
      }).ga4Configured,
    ).toBe(true);
    expect(
      connectorEnvReadiness({
        LINKEDIN_CLIENT_ID: "id",
        LINKEDIN_CLIENT_SECRET: "secret",
      }).linkedinConfigured,
    ).toBe(false);
    expect(
      connectorEnvReadiness({
        LINKEDIN_CLIENT_ID: "id",
        LINKEDIN_CLIENT_SECRET: "secret",
        LINKEDIN_AD_ACCOUNT_ID: "123",
      }).linkedinConfigured,
    ).toBe(true);
  });

  it("separates configured connectors from connected connectors", () => {
    const configured = buildConnectorContracts({
      metaAuthenticated: false,
      apifyConfigured: false,
      googleAdsConfigured: true,
      youtubeConfigured: true,
      ga4Configured: true,
      linkedinConfigured: true,
    });
    expect(configured.find((item) => item.id === "google_ads")?.state).toBe(
      "needs_connection",
    );
    expect(
      configured.find((item) => item.id === "youtube_analytics")?.state,
    ).toBe("needs_connection");
    expect(
      configured.find((item) => item.id === "ga4_attribution")?.state,
    ).toBe("needs_connection");
    expect(configured.find((item) => item.id === "linkedin_ads")?.state).toBe(
      "needs_connection",
    );
    const connected = buildConnectorContracts({
      metaAuthenticated: false,
      apifyConfigured: false,
      googleAdsConfigured: true,
      youtubeConfigured: true,
      ga4Configured: true,
      linkedinConfigured: true,
      googleAdsConnected: true,
      youtubeConnected: true,
      ga4Connected: true,
      linkedinConnected: true,
    });
    expect(connected.find((item) => item.id === "google_ads")?.state).toBe(
      "available",
    );
    expect(
      connected.find((item) => item.id === "youtube_analytics")?.state,
    ).toBe("available");
    expect(connected.find((item) => item.id === "ga4_attribution")?.state).toBe(
      "available",
    );
    expect(connected.find((item) => item.id === "linkedin_ads")?.state).toBe(
      "available",
    );
  });

  it("maps OAuth providers and cron-only server tokens by sync platform", () => {
    expect(connectorProviderForPlatform("google_ads")).toBe("google");
    expect(connectorProviderForPlatform("youtube")).toBe("google");
    expect(connectorProviderForPlatform("linkedin")).toBe("linkedin");
    expect(
      connectorAccessTokenForPlatform("google_ads", {
        GOOGLE_ADS_ACCESS_TOKEN: "ads",
      }),
    ).toBe("ads");
    expect(
      connectorAccessTokenForPlatform("youtube", {
        YOUTUBE_ACCESS_TOKEN: "youtube",
        GOOGLE_ADS_ACCESS_TOKEN: "ads",
      }),
    ).toBe("youtube");
    expect(
      connectorAccessTokenForPlatform("youtube", {
        GOOGLE_ADS_ACCESS_TOKEN: "ads",
      }),
    ).toBe("ads");
    expect(
      connectorAccessTokenForPlatform("linkedin", {
        LINKEDIN_ACCESS_TOKEN: "linkedin",
      }),
    ).toBe("linkedin");
  });

  it("does not mark backlog platforms available from credentials alone", () => {
    const backlog = buildBacklogPlatformContracts({
      X_ADS_CLIENT_ID: "configured",
      PINTEREST_APP_ID: "configured",
    });
    expect(backlog.every((item) => item.state === "needs_setup")).toBe(true);
  });
});
