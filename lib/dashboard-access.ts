export type DashboardView = "ads" | "competitor";

export function canOpenDashboardView(input: { authenticated: boolean; activeView: DashboardView }) {
  return input.authenticated || input.activeView === "competitor";
}

export function initialDashboardViewFromSearch(search: string): DashboardView {
  const value = new URLSearchParams(search).get("view");
  return value === "competitor" ? "competitor" : "ads";
}
