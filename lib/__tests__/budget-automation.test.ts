import { describe, expect, it } from "vitest";
import { assessPacing, bidMultiplierAt, bidRule, buildPacingPlan, enforcePlatformCaps, estimateBayesianHierarchicalSpendCurves, estimateHierarchicalSpendCurves, learningPhaseProtection, recommendBidStrategy } from "@/lib/budget-automation";

describe("budget automation", () => {
  it("builds spend curves and flags >10% pacing deviation", () => {
    const plan = buildPacingPlan({ cadence: "monthly", curve: "linear", totalBudget: 3100, startDate: "2026-07-01", endDate: "2026-07-31" });
    const result = assessPacing({ plan, actualSpend: 500, asOfDate: "2026-07-15" });
    expect(plan.targets).toHaveLength(31);
    expect(result.status).toBe("underspend");
    expect(result.alert).toBe(true);
  });

  it("projects non-linear pacing against the selected spend curve", () => {
    const plan = buildPacingPlan({ cadence: "monthly", curve: "front_loaded", totalBudget: 3100, startDate: "2026-07-01", endDate: "2026-07-31" });
    const targetToDate = plan.targets[14].cumulativeTarget;
    const result = assessPacing({ plan, actualSpend: targetToDate, asOfDate: "2026-07-15" });
    expect(result.projectedEndSpend).toBeCloseTo(3100);
    expect(result.status).toBe("on_pace");
  });

  it("requires a complete, positive custom daily curve", () => {
    expect(() => buildPacingPlan({ cadence: "weekly", curve: "custom", totalBudget: 700, startDate: "2026-07-01", endDate: "2026-07-07", customWeights: [1, 1] })).toThrow("exactly 7 daily weights");
    expect(() => buildPacingPlan({ cadence: "weekly", curve: "custom", totalBudget: 700, startDate: "2026-07-01", endDate: "2026-07-07", customWeights: Array(7).fill(0) })).toThrow("at least one positive value");
    expect(buildPacingPlan({ cadence: "weekly", curve: "custom", totalBudget: 700, startDate: "2026-07-01", endDate: "2026-07-07", customWeights: [2, 1, 1, 1, 1, 1, 1] }).targets[0].targetSpend).toBe(175);
  });

  it("enforces caps, dayparts, bid rules, and learning protection", () => {
    expect(enforcePlatformCaps([{ id: "a", platform: "meta", spend: 120, cap: 100, roas: 1, active: true, dailyBudget: 150 }, { id: "b", platform: "google", spend: 50, cap: 100, roas: 2, active: true }])).toMatchObject({ stopped: ["a"], redistribute: 30, nextBestCampaignId: "b" });
    expect(bidMultiplierAt([{ day: 3, startHour: 9, endHour: 17, bidMultiplier: 1.2 }], new Date("2026-07-29T10:00:00Z"))).toBe(1.2);
    expect(bidRule({ actualCpa: 70, targetCpa: 100, currentBid: 10 }).action).toBe("increase");
    expect(learningPhaseProtection({ learningStatus: "LEARNING", requestedChangePercent: 10 }).allowed).toBe(false);
  });

  it("shrinks sparse response curves and recommends stable bid strategies", () => {
    expect(estimateHierarchicalSpendCurves([{ campaignId: "c1", platform: "meta", spend: 100, revenue: 300 }])[0].curve).toHaveLength(4);
    expect(recommendBidStrategy({ cpaHistory: [90, 92, 91, 93, 89, 90, 91], roasHistory: [], targetCpa: 100 }).strategy).toBe("cost_cap");
  });

  it("fits a Bayesian hierarchical posterior with stronger shrinkage for sparse campaigns", () => {
    const estimate = estimateBayesianHierarchicalSpendCurves([
      {
        campaignId: "sparse",
        platform: "meta",
        spend: 100,
        revenue: 1000,
        observations: [{ date: "2026-07-29", spend: 100, revenue: 1000 }],
      },
      {
        campaignId: "established",
        platform: "google_ads",
        spend: 500,
        revenue: 1000,
        observations: Array.from({ length: 5 }, (_value, index) => ({
          date: `2026-07-${String(index + 20).padStart(2, "0")}`,
          spend: 100,
          revenue: 200,
        })),
      },
    ]);
    const sparse = estimate.diagnostics.find((item) => item.campaignId === "sparse")!;
    const established = estimate.diagnostics.find((item) => item.campaignId === "established")!;

    expect(estimate.model.kind).toBe("bayesian_hierarchical_log_roas");
    expect(sparse.priorWeight).toBeGreaterThan(established.priorWeight);
    expect(sparse.posteriorRoas).toBeLessThan(sparse.observedRoas);
    expect(sparse.posteriorRoas).toBeGreaterThan(established.posteriorRoas);
  });
});
