import { describe, expect, it } from "vitest";
import { canOpenDashboardView, initialDashboardViewFromSearch } from "../dashboard-access";

describe("canOpenDashboardView", () => {
  it("allows competitor spy without a Meta token but keeps ads analysis gated", () => {
    expect(canOpenDashboardView({ authenticated: false, activeView: "competitor" })).toBe(true);
    expect(canOpenDashboardView({ authenticated: false, activeView: "ads" })).toBe(false);
    expect(canOpenDashboardView({ authenticated: true, activeView: "ads" })).toBe(true);
  });

  it("can deep-link directly into competitor spy", () => {
    expect(initialDashboardViewFromSearch("?view=competitor")).toBe("competitor");
    expect(initialDashboardViewFromSearch("?view=ads")).toBe("ads");
    expect(initialDashboardViewFromSearch("")).toBe("ads");
  });
});
