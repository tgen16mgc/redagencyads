import { describe, expect, it } from "vitest";
import { canOpenDashboardView, initialDashboardViewFromSearch, shouldLoadAdsWorkspaceData } from "../dashboard-access";

describe("canOpenDashboardView", () => {
  it("allows competitor spy without a Meta token but keeps authenticated workspaces gated", () => {
    expect(canOpenDashboardView({ authenticated: false, activeView: "competitor" })).toBe(true);
    expect(canOpenDashboardView({ authenticated: false, activeView: "tiktok" })).toBe(true);
    expect(canOpenDashboardView({ authenticated: false, activeView: "ads" })).toBe(false);
    expect(canOpenDashboardView({ authenticated: false, activeView: "publisher" })).toBe(false);
    expect(canOpenDashboardView({ authenticated: true, activeView: "ads" })).toBe(true);
    expect(canOpenDashboardView({ authenticated: true, activeView: "publisher" })).toBe(true);
    expect(canOpenDashboardView({ authenticated: true, activeView: "tiktok" })).toBe(true);
  });

  it("can deep-link directly into secondary workspaces", () => {
    expect(initialDashboardViewFromSearch("?view=competitor")).toBe("competitor");
    expect(initialDashboardViewFromSearch("?view=publisher")).toBe("publisher");
    expect(initialDashboardViewFromSearch("?view=tiktok")).toBe("tiktok");
    expect(initialDashboardViewFromSearch("?view=ads")).toBe("ads");
    expect(initialDashboardViewFromSearch("")).toBe("ads");
  });

  it("loads ad workspace data only for the ads view", () => {
    expect(shouldLoadAdsWorkspaceData({ authenticated: true, activeView: "ads" })).toBe(true);
    expect(shouldLoadAdsWorkspaceData({ authenticated: true, activeView: "publisher" })).toBe(false);
    expect(shouldLoadAdsWorkspaceData({ authenticated: true, activeView: "competitor" })).toBe(false);
    expect(shouldLoadAdsWorkspaceData({ authenticated: true, activeView: "tiktok" })).toBe(false);
    expect(shouldLoadAdsWorkspaceData({ authenticated: false, activeView: "ads" })).toBe(false);
  });
});
