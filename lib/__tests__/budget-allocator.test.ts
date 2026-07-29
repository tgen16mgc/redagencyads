import { describe, expect, it } from "vitest";
import {
  allocateBudget,
  scenarioBudget,
  scenarioWithPlatformShocks,
} from "@/lib/budget-allocator";

const curves = [
  {
    id: "meta",
    platform: "meta",
    currentSpend: 1000,
    currentRevenue: 1800,
    minSpend: 500,
    maxSpend: 3000,
    curve: [
      { spend: 500, revenue: 1000 },
      { spend: 1000, revenue: 1800 },
      { spend: 2000, revenue: 3000 },
      { spend: 3000, revenue: 3600 },
    ],
  },
  {
    id: "google",
    platform: "google_ads",
    currentSpend: 1000,
    currentRevenue: 1400,
    minSpend: 500,
    maxSpend: 3000,
    minRoas: 1.2,
    curve: [
      { spend: 500, revenue: 800 },
      { spend: 1000, revenue: 1400 },
      { spend: 2000, revenue: 2500 },
      { spend: 3000, revenue: 3000 },
    ],
  },
];

describe("cross-channel budget allocator", () => {
  it("solves the piecewise linear allocation under budget, bound, and ROAS constraints", () => {
    const result = allocateBudget({ totalBudget: 4000, curves, step: 500 });
    expect(result.totalSpend).toBe(4000);
    expect(result.projectedRevenue).toBeGreaterThan(0);
    expect(
      result.allocations.find((item) => item.id === "meta")?.spend,
    ).toBeGreaterThanOrEqual(1000);
    expect(result.optimization).toMatchObject({
      solver: "piecewise_linear_program",
      objective: "maximize_projected_revenue",
      status: "optimal",
      budgetGap: 0,
    });
  });

  it("rejects an infeasible minimum-spend constraint instead of exceeding the budget", () => {
    expect(() =>
      allocateBudget({
        totalBudget: 100,
        curves: [{ ...curves[0], minSpend: 200 }],
      }),
    ).toThrow(/minimum spends total/i);
  });

  it("supports what-if budget scenarios", () => {
    expect(scenarioBudget(curves, 1.2).totalSpend).toBeGreaterThan(2000);
  });

  it("models a platform CPM shock without treating public intelligence as performance", () => {
    const baseline = scenarioWithPlatformShocks({ curves, totalBudget: 2000 });
    const shocked = scenarioWithPlatformShocks({
      curves,
      totalBudget: 2000,
      shocks: [{ platform: "google_ads", multiplier: 1.3 }],
    });
    expect(shocked.projectedRevenue).toBeLessThan(baseline.projectedRevenue);
    expect(shocked.assumptions).toEqual(["google_ads CPM ×1.30"]);
  });

  it("enforces minimum ROAS on total projected return rather than every marginal segment", () => {
    const result = allocateBudget({
      totalBudget: 2000,
      curves: [
        {
          id: "aggregate-roas",
          platform: "meta",
          currentSpend: 1000,
          currentRevenue: 2000,
          minSpend: 1000,
          maxSpend: 2000,
          minRoas: 1.2,
          curve: [
            { spend: 0, revenue: 0 },
            { spend: 1000, revenue: 2000 },
            { spend: 2000, revenue: 3000 },
          ],
        },
      ],
    });
    expect(result.totalSpend).toBe(2000);
    expect(result.projectedRoas).toBe(1.5);
  });

  it("rejects increasing marginal-return curves that invalidate the exact greedy LP solution", () => {
    expect(() =>
      allocateBudget({
        totalBudget: 2000,
        curves: [
          {
            id: "non-concave",
            platform: "meta",
            currentSpend: 1000,
            currentRevenue: 500,
            minSpend: 0,
            maxSpend: 2000,
            curve: [
              { spend: 0, revenue: 0 },
              { spend: 1000, revenue: 500 },
              { spend: 2000, revenue: 2000 },
            ],
          },
        ],
      }),
    ).toThrow(/non-increasing marginal ROAS/i);
  });
});
