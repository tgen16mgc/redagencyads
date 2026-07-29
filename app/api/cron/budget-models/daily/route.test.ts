import { describe, expect, it, vi } from "vitest";

const { refreshDailyBudgetModels } = vi.hoisted(() => ({ refreshDailyBudgetModels: vi.fn() }));
vi.mock("@/lib/budget-models", () => ({ refreshDailyBudgetModels }));

import { GET } from "./route";

describe("daily budget model cron", () => {
  it("refreshes the owned-performance response curves", async () => {
    refreshDailyBudgetModels.mockResolvedValue({ generatedAt: "2026-07-29T01:30:00Z", rowCount: 4, curves: [] });
    const response = await GET(new Request("http://localhost/api/cron/budget-models/daily"));
    expect(response.status).toBe(200);
    expect(refreshDailyBudgetModels).toHaveBeenCalledOnce();
  });
});
