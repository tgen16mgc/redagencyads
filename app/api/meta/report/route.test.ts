import { describe, expect, it, vi } from "vitest";

const { buildReport, requireToken } = vi.hoisted(() => ({ buildReport: vi.fn(), requireToken: vi.fn() }));
vi.mock("@/lib/meta", () => ({ buildReport }));
vi.mock("@/lib/session", () => ({ requireToken, sessionErrorStatus: () => 400 }));

describe("report date validation", () => {
  it.each([
    ["2026-08-05", "2026-08-01"],
    ["2026-02-30", "2026-03-05"],
  ])("rejects invalid range %s to %s before fetching Meta", async (since, until) => {
    const { GET } = await import("./route");
    const response = await GET(new Request(`http://localhost/api/meta/report?accountId=act_test&since=${since}&until=${until}`));
    expect(response.status).toBe(400);
    expect(requireToken).not.toHaveBeenCalled();
    expect(buildReport).not.toHaveBeenCalled();
  });
});
