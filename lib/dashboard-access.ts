export type DashboardView = "ads" | "competitor" | "publisher" | "tiktok";

export function canOpenDashboardView(input: { authenticated: boolean; activeView: DashboardView }) {
  return input.authenticated || input.activeView === "competitor" || input.activeView === "tiktok";
}

export function initialDashboardViewFromSearch(search: string): DashboardView {
  const value = new URLSearchParams(search).get("view");
  if (value === "competitor" || value === "publisher" || value === "tiktok") return value;
  return "ads";
}

export function shouldLoadAdsWorkspaceData(input: { authenticated: boolean; activeView: DashboardView }) {
  return input.authenticated && input.activeView === "ads";
}
