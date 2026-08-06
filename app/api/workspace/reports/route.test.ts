import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient, ensureActiveWorkspaceMembership, getWorkspaceAuthMode } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  ensureActiveWorkspaceMembership: vi.fn(),
  getWorkspaceAuthMode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/workspace-session", () => ({ ensureActiveWorkspaceMembership, getWorkspaceAuthMode }));

import { GET, POST } from "./route";

describe("/api/workspace/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceAuthMode.mockReturnValue("supabase");
    ensureActiveWorkspaceMembership.mockResolvedValue({ workspace_id: "workspace-1", role: "owner" });
  });

  it("returns the latest saved reports for the signed-in user", async () => {
    const rows = [{
      id: "report-1",
      account_id: "act-1",
      account_name: "Agency",
      date_since: "2026-07-01",
      date_until: "2026-07-31",
      selected_pack: "sales_roas",
      report: { account: { id: "act-1", name: "Agency" } },
      previous_report: null,
      verdict: null,
      insights: null,
      updated_at: "2026-08-06T00:00:00Z",
    }];
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: vi.fn().mockReturnValue(query),
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reports[0]).toMatchObject({ id: "report-1", accountId: "act-1", accountName: "Agency" });
    expect(ensureActiveWorkspaceMembership).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("upserts report, comparison, verdict, and insights", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: vi.fn().mockReturnValue({ upsert }),
    });
    const report = {
      account: { id: "act-1", name: "Agency" },
      dateRange: { since: "2026-07-01", until: "2026-07-31" },
      selectedPack: "sales_roas",
    };

    const response = await POST(new Request("https://workspace.example/api/workspace/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ report, previousReport: null, verdict: { verdict: "Hold" }, insights: { rows: [] } }),
    }));

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: "workspace-1",
      user_id: "user-1",
      account_id: "act-1",
      report,
      verdict: { verdict: "Hold" },
      insights: { rows: [] },
    }), { onConflict: "user_id,account_id,date_since,date_until,selected_pack" });
  });
});
