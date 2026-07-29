import { describe, expect, it } from "vitest";
import {
  assignExperiment,
  buildContinuousExperimentResultDashboard,
  buildExperimentPlan,
  buildExperimentResultDashboard,
  evaluateContinuousMsprt,
  evaluateMsprt,
  evaluateSequentialTest,
  saveExperimentLog,
  searchExperimentLog,
} from "@/lib/experiment-engine";

describe("experiment engine", () => {
  it("calculates a ready binary-metric plan with allocation and duration", () => {
    const plan = buildExperimentPlan(
      {
        id: "exp-1",
        hypothesis: "UGC lowers CPA",
        metric: "conversion_rate",
        baselineRate: 0.04,
        minimumDetectableEffect: 0.2,
        confidence: 0.95,
        power: 0.8,
        trafficAllocation: 0.5,
        assignmentUnit: "user",
        guardrails: ["CPA"],
        layer: "creative",
      },
      5000,
    );
    expect(plan.status).toBe("ready");
    expect(plan.totalRequiredSamples).toBeGreaterThan(0);
    expect(plan.estimatedDays).toBeGreaterThan(0);
  });

  it("uses continuous-metric variance instead of treating CPA as a binary rate", () => {
    const incomplete = buildExperimentPlan({
      id: "cpa",
      hypothesis: "Treatment lowers CPA",
      metric: "cpa",
      baselineRate: 50,
      minimumDetectableEffect: 0.2,
      confidence: 0.95,
      power: 0.8,
      trafficAllocation: 0.5,
      assignmentUnit: "user",
      guardrails: [],
      layer: "creative",
    });
    expect(incomplete).toMatchObject({
      status: "needs_fix",
      metricFamily: "continuous",
      metricDirection: "lower",
    });
    expect(incomplete.blockers.join(" ")).toMatch(/standard deviation/i);
    const ready = buildExperimentPlan({
      ...incomplete.definition,
      baselineStandardDeviation: 20,
    });
    expect(ready.status).toBe("ready");
    expect(ready.totalRequiredSamples).toBeGreaterThan(0);
  });

  it("supports efficacy, futility, and continue sequential decisions", () => {
    expect(
      evaluateSequentialTest({
        controlRate: 0.04,
        treatmentRate: 0.06,
        controlSamples: 10000,
        treatmentSamples: 10000,
      }).recommendation,
    ).toBe("ship");
    expect(
      evaluateSequentialTest({
        controlRate: 0.06,
        treatmentRate: 0.04,
        controlSamples: 10000,
        treatmentSamples: 10000,
      }).recommendation,
    ).toBe("kill");
    expect(
      evaluateSequentialTest({
        controlRate: 0.04,
        treatmentRate: 0.0401,
        controlSamples: 100,
        treatmentSamples: 100,
      }).recommendation,
    ).toBe("keep_running");
  });

  it("assigns deterministically and protects mutually exclusive layers", () => {
    const first = assignExperiment({
      experimentId: "exp",
      layer: "creative",
      unitId: "user-1",
      treatmentAllocation: 0.5,
    });
    expect(
      assignExperiment({
        experimentId: "exp",
        layer: "creative",
        unitId: "user-1",
        treatmentAllocation: 0.5,
      }).variant,
    ).toBe(first.variant);
    expect(() =>
      assignExperiment({
        experimentId: "other",
        layer: "creative",
        unitId: "user-1",
        treatmentAllocation: 0.5,
        activeAssignments: [first],
      }),
    ).toThrow("mutually exclusive");
  });

  it("returns mSPRT boundaries and saves searchable learnings", () => {
    const sequential = evaluateMsprt({
      controlSuccesses: 400,
      controlSamples: 10000,
      treatmentSuccesses: 520,
      treatmentSamples: 10000,
      relativeMde: 0.1,
    });
    expect(sequential.efficacyBoundary).toBeGreaterThan(1);
    expect(sequential).toMatchObject({
      method: "one_sided_normal_mixture_msprt",
      futilityIsNonBinding: true,
    });
    const dashboard = buildExperimentResultDashboard({
      controlSuccesses: 400,
      controlSamples: 10000,
      treatmentSuccesses: 520,
      treatmentSamples: 10000,
    });
    const definition = {
      id: "ugc-learning",
      hypothesis: "UGC outperforms studio",
      metric: "conversion_rate" as const,
      baselineRate: 0.04,
      minimumDetectableEffect: 0.1,
      confidence: 0.95,
      power: 0.8,
      trafficAllocation: 0.5,
      assignmentUnit: "user" as const,
      guardrails: [],
      layer: "creative",
    };
    saveExperimentLog({ definition, result: dashboard });
    expect(searchExperimentLog("ugc")[0].tags).toContain("ugc");
  });

  it("uses both control and treatment likelihoods for the mSPRT ratio", () => {
    const result = evaluateMsprt({
      controlSuccesses: 100,
      controlSamples: 1000,
      treatmentSuccesses: 100,
      treatmentSamples: 1000,
      relativeMde: 0.1,
    });
    expect(result.status).toBe("continue");
    expect(Number.isFinite(result.likelihoodRatio)).toBe(true);
  });

  it("evaluates lower-is-better continuous outcomes with the mixture sequential test", () => {
    const sequential = evaluateContinuousMsprt({
      metric: "cpa",
      controlMean: 50,
      controlStandardDeviation: 20,
      controlSamples: 1000,
      treatmentMean: 45,
      treatmentStandardDeviation: 20,
      treatmentSamples: 1000,
      relativeMde: 0.2,
    });
    expect(sequential.recommendation).toBe("ship");
    const dashboard = buildContinuousExperimentResultDashboard({
      metric: "cpa",
      controlMean: 50,
      controlStandardDeviation: 20,
      controlSamples: 1000,
      treatmentMean: 45,
      treatmentStandardDeviation: 20,
      treatmentSamples: 1000,
    });
    expect(dashboard).toMatchObject({
      metricFamily: "continuous",
      metricDirection: "lower",
      recommendation: "ship",
      lift: 0.1,
    });
    expect(dashboard.confidenceInterval[0]).toBeGreaterThan(0);
  });
});
