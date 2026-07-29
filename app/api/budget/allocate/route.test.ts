import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/budget/allocate", () => {
  it("returns a constrained allocation", async () => {
    const response = await POST(new Request("http://localhost/api/budget/allocate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ totalBudget: 2000, step: 500, curves: [{ id: "meta", platform: "meta", currentSpend: 1000, currentRevenue: 1500, minSpend: 500, maxSpend: 2500, curve: [{ spend: 500, revenue: 900 }, { spend: 1000, revenue: 1500 }, { spend: 2000, revenue: 2500 }] }] }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).result.totalSpend).toBe(2000);
  });

  it("applies declared CPM shocks to scenario curves", async () => {
    const response = await POST(new Request("http://localhost/api/budget/allocate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ totalBudget: 1000, curves: [{ id: "tiktok", platform: "tiktok", currentSpend: 1000, currentRevenue: 1800, minSpend: 1000, maxSpend: 1000, curve: [{ spend: 0, revenue: 0 }, { spend: 1000, revenue: 1800 }] }], cpmShocks: [{ platform: "tiktok", multiplier: 1.3 }] }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.assumptions).toEqual(["tiktok CPM ×1.30"]);
    expect(body.result.projectedRevenue).toBeCloseTo(1800 / 1.3);
  });
});
