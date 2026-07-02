export type DashboardView = "ads" | "competitor" | "publisher";

export function canOpenDashboardView(input: { authenticated: boolean; activeView: DashboardView }) {
  return input.authenticated || input.activeView === "competitor";
}

export function initialDashboardViewFromSearch(search: string): DashboardView {
  const value = new URLSearchParams(search).get("view");
  if (value === "competitor" || value === "publisher") return value;
  return "ads";
}

export function shouldLoadAdsWorkspaceData(input: { authenticated: boolean; activeView: DashboardView }) {
  return input.authenticated && input.activeView === "ads";
}
