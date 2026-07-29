export type DashboardView = "overview" | "ads" | "competitor" | "publisher" | "tiktok" | "intelligence";

export function canOpenDashboardView(input: { authenticated: boolean; activeView: DashboardView }) {
  return input.authenticated || input.activeView === "overview" || input.activeView === "competitor" || input.activeView === "tiktok" || input.activeView === "intelligence";
}

export function initialDashboardViewFromSearch(search: string): DashboardView {
  const value = new URLSearchParams(search).get("view");
  if (value === "ads" || value === "competitor" || value === "publisher" || value === "tiktok" || value === "intelligence") return value;
  return "overview";
}

export function shouldLoadAdsWorkspaceData(input: { authenticated: boolean; activeView: DashboardView }) {
  return input.authenticated && (input.activeView === "overview" || input.activeView === "ads");
}
