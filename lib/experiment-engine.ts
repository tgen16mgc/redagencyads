export type ExperimentMetric =
  "cpa" | "roas" | "ctr" | "conversion_rate" | "cost_per_lead";
export type ExperimentUnit = "user" | "geo";

export type ExperimentDefinition = {
  id: string;
  hypothesis: string;
  metric: ExperimentMetric;
  baselineRate: number;
  baselineStandardDeviation?: number;
  minimumDetectableEffect: number;
  confidence: number;
  power: number;
  trafficAllocation: number;
  assignmentUnit: ExperimentUnit;
  guardrails: string[];
  layer: string;
};

export type ExperimentPlan = {
  definition: ExperimentDefinition;
  variants: {
    name: "control" | "treatment";
    allocation: number;
    requiredSamples: number;
  }[];
  totalRequiredSamples: number;
  estimatedDays?: number;
  blockers: string[];
  status: "ready" | "needs_fix";
  metricFamily: "binary" | "continuous";
  metricDirection: "higher" | "lower";
};

export function experimentMetricFamily(metric: ExperimentMetric) {
  return metric === "ctr" || metric === "conversion_rate"
    ? ("binary" as const)
    : ("continuous" as const);
}

export function experimentMetricDirection(metric: ExperimentMetric) {
  return metric === "cpa" || metric === "cost_per_lead"
    ? ("lower" as const)
    : ("higher" as const);
}

const normalQuantile = (p: number) => {
  if (p <= 0 || p >= 1) return 0;
  const a1 = -39.6968302866538,
    a2 = 220.946098424521,
    a3 = -275.928510446969;
  const a4 = 138.357751867269,
    a5 = -30.6647980661472,
    a6 = 2.50662827745924;
  const b1 = -54.4760987982241,
    b2 = 161.585836858041,
    b3 = -155.698979859887;
  const b4 = 66.8013118877197,
    b5 = -13.2806815528857;
  const c1 = -0.00778489400243029,
    c2 = -0.322396458041136,
    c3 = -2.40075827716184;
  const c4 = -2.54973253934373,
    c5 = 4.37466414146497,
    c6 = 2.93816398269878;
  const d1 = 0.00778469570904146,
    d2 = 0.32246712907004,
    d3 = 2.445134137143;
  const d4 = 3.75440866190742;
  const plow = 0.02425,
    phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
};

export function requiredSamplesForBinaryMetric(
  baselineRate: number,
  relativeMde: number,
  confidence = 0.95,
  power = 0.8,
) {
  const baseline = Math.min(0.999, Math.max(0.0001, baselineRate));
  const treatment = Math.min(
    0.999,
    Math.max(0.0001, baseline * (1 + relativeMde)),
  );
  const alpha = 1 - confidence;
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  const pooled = (baseline + treatment) / 2;
  const numerator =
    (zAlpha * Math.sqrt(2 * pooled * (1 - pooled)) +
      zBeta *
        Math.sqrt(baseline * (1 - baseline) + treatment * (1 - treatment))) **
    2;
  const denominator = (treatment - baseline) ** 2;
  return Math.ceil(Math.max(100, numerator / denominator));
}

export function requiredSamplesForContinuousMetric(
  baselineValue: number,
  relativeMde: number,
  standardDeviation: number,
  confidence = 0.95,
  power = 0.8,
) {
  const absoluteEffect = Math.abs(baselineValue * relativeMde);
  if (absoluteEffect <= 0 || standardDeviation <= 0) return 0;
  const alpha = 1 - confidence;
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  return Math.ceil(
    Math.max(
      20,
      2 * (((zAlpha + zBeta) * standardDeviation) / absoluteEffect) ** 2,
    ),
  );
}

export function buildExperimentPlan(
  definition: ExperimentDefinition,
  observedDailyEligibleUsers?: number,
): ExperimentPlan {
  const blockers: string[] = [];
  const metricFamily = experimentMetricFamily(definition.metric);
  const metricDirection = experimentMetricDirection(definition.metric);
  if (!definition.hypothesis.trim()) blockers.push("Hypothesis is required.");
  if (definition.minimumDetectableEffect <= 0)
    blockers.push("Minimum detectable effect must be greater than zero.");
  if (definition.confidence <= 0.5 || definition.confidence >= 1)
    blockers.push("Confidence must be between 50% and 100%.");
  if (definition.power <= 0.5 || definition.power >= 1)
    blockers.push("Power must be between 50% and 100%.");
  if (definition.trafficAllocation <= 0 || definition.trafficAllocation > 1)
    blockers.push("Traffic allocation must be between 0 and 100%.");
  if (
    metricFamily === "binary" &&
    (definition.baselineRate <= 0 || definition.baselineRate >= 1)
  )
    blockers.push("Binary metric baseline must be between zero and one.");
  if (
    metricFamily === "continuous" &&
    (!definition.baselineStandardDeviation ||
      definition.baselineStandardDeviation <= 0)
  )
    blockers.push(
      "Baseline standard deviation is required for CPA, ROAS, and cost-per-lead tests.",
    );
  const requiredSamples =
    metricFamily === "binary"
      ? requiredSamplesForBinaryMetric(
          definition.baselineRate,
          definition.minimumDetectableEffect,
          definition.confidence,
          definition.power,
        )
      : requiredSamplesForContinuousMetric(
          definition.baselineRate,
          definition.minimumDetectableEffect,
          definition.baselineStandardDeviation || 0,
          definition.confidence,
          definition.power,
        );
  const treatmentAllocation = Math.min(
    0.95,
    Math.max(0.05, definition.trafficAllocation),
  );
  const controlAllocation = 1 - treatmentAllocation;
  const totalRequiredSamples = Math.ceil(
    requiredSamples / Math.min(controlAllocation, treatmentAllocation),
  );
  const estimatedDays =
    observedDailyEligibleUsers && observedDailyEligibleUsers > 0
      ? Math.ceil(totalRequiredSamples / observedDailyEligibleUsers)
      : undefined;
  return {
    definition,
    variants: [
      {
        name: "control",
        allocation: controlAllocation,
        requiredSamples: Math.ceil(totalRequiredSamples * controlAllocation),
      },
      {
        name: "treatment",
        allocation: treatmentAllocation,
        requiredSamples: Math.ceil(totalRequiredSamples * treatmentAllocation),
      },
    ],
    totalRequiredSamples,
    estimatedDays,
    blockers,
    status: blockers.length ? "needs_fix" : "ready",
    metricFamily,
    metricDirection,
  };
}

export type SequentialTestResult = {
  status: "continue" | "efficacy" | "futility";
  lift: number;
  zScore: number;
  boundary: number;
  recommendation: "keep_running" | "ship" | "kill";
};

export function evaluateSequentialTest(input: {
  controlRate: number;
  treatmentRate: number;
  controlSamples: number;
  treatmentSamples: number;
  alpha?: number;
}): SequentialTestResult {
  const control = Math.max(0.0001, input.controlRate);
  const treatment = Math.max(0.0001, input.treatmentRate);
  const pooled =
    (control * input.controlSamples + treatment * input.treatmentSamples) /
    Math.max(1, input.controlSamples + input.treatmentSamples);
  const standardError = Math.sqrt(
    Math.max(
      1e-9,
      pooled *
        (1 - pooled) *
        (1 / Math.max(1, input.controlSamples) +
          1 / Math.max(1, input.treatmentSamples)),
    ),
  );
  const zScore = (treatment - control) / standardError;
  const boundary = normalQuantile(1 - (input.alpha || 0.05) / 2) * 1.15;
  const status =
    zScore >= boundary
      ? "efficacy"
      : zScore <= -boundary
        ? "futility"
        : "continue";
  return {
    status,
    lift: (treatment - control) / control,
    zScore,
    boundary,
    recommendation:
      status === "efficacy"
        ? "ship"
        : status === "futility"
          ? "kill"
          : "keep_running",
  };
}

function stableUnitHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export type ExperimentAssignment = {
  experimentId: string;
  layer: string;
  unitId: string;
  variant: "control" | "treatment" | "holdout";
  assignedAt: string;
};

export function assignExperiment(input: {
  experimentId: string;
  layer: string;
  unitId: string;
  treatmentAllocation: number;
  trafficAllocation?: number;
  activeAssignments?: ExperimentAssignment[];
}): ExperimentAssignment {
  const conflict = (input.activeAssignments || []).find(
    (assignment) =>
      assignment.unitId === input.unitId &&
      assignment.layer === input.layer &&
      assignment.experimentId !== input.experimentId &&
      assignment.variant !== "holdout",
  );
  if (conflict)
    throw new Error(
      `Unit is already assigned to ${conflict.experimentId} in mutually exclusive layer ${input.layer}.`,
    );
  const traffic = Math.min(1, Math.max(0, input.trafficAllocation ?? 1));
  const bucket = stableUnitHash(`${input.experimentId}:${input.unitId}`);
  const variant =
    bucket >= traffic
      ? "holdout"
      : bucket / Math.max(traffic, 1e-9) <
          Math.min(0.95, Math.max(0.05, input.treatmentAllocation))
        ? "treatment"
        : "control";
  return {
    experimentId: input.experimentId,
    layer: input.layer,
    unitId: input.unitId,
    variant,
    assignedAt: new Date().toISOString(),
  };
}

function normalMixtureLikelihoodRatio(input: {
  improvement: number;
  standardError: number;
  priorScale: number;
}) {
  const variance = Math.max(1e-12, input.standardError ** 2);
  const information = 1 / variance;
  const score = input.improvement / variance;
  const priorVariance = Math.max(1e-12, input.priorScale ** 2);
  const denominator = 1 + priorVariance * information;
  const posteriorZ =
    (Math.sqrt(priorVariance) * score) / Math.sqrt(denominator);
  const logLikelihoodRatio =
    Math.log(2) -
    0.5 * Math.log(denominator) +
    (priorVariance * score ** 2) / (2 * denominator) +
    Math.log(Math.max(1e-300, normalCdf(posteriorZ)));
  return Math.exp(Math.min(700, logLikelihoodRatio));
}

function sequentialDecision(
  likelihoodRatio: number,
  samplesPerVariant: number,
  alpha = 0.05,
  beta = 0.2,
) {
  const efficacyBoundary = 1 / alpha;
  const futilityBoundary = beta;
  const status =
    likelihoodRatio >= efficacyBoundary
      ? ("efficacy" as const)
      : likelihoodRatio <= futilityBoundary && samplesPerVariant >= 100
        ? ("futility" as const)
        : ("continue" as const);
  return {
    status,
    recommendation:
      status === "efficacy"
        ? ("ship" as const)
        : status === "futility"
          ? ("kill" as const)
          : ("keep_running" as const),
    efficacyBoundary,
    futilityBoundary,
    futilityIsNonBinding: true,
    method: "one_sided_normal_mixture_msprt" as const,
  };
}

export function evaluateMsprt(input: {
  controlSuccesses: number;
  controlSamples: number;
  treatmentSuccesses: number;
  treatmentSamples: number;
  relativeMde: number;
  alpha?: number;
  beta?: number;
}) {
  const controlRate =
    input.controlSamples > 0
      ? input.controlSuccesses / input.controlSamples
      : 0;
  const treatmentRate =
    input.treatmentSamples > 0
      ? input.treatmentSuccesses / input.treatmentSamples
      : 0;
  const pooled = Math.min(
    0.9999,
    Math.max(
      0.0001,
      (input.controlSuccesses + input.treatmentSuccesses) /
        Math.max(1, input.controlSamples + input.treatmentSamples),
    ),
  );
  const standardError = Math.sqrt(
    Math.max(
      1e-12,
      pooled *
        (1 - pooled) *
        (1 / input.controlSamples + 1 / input.treatmentSamples),
    ),
  );
  const priorScale = Math.max(1e-6, pooled * input.relativeMde);
  const likelihoodRatio = normalMixtureLikelihoodRatio({
    improvement: treatmentRate - controlRate,
    standardError,
    priorScale,
  });
  const alpha = input.alpha || 0.05;
  const beta = input.beta || 0.2;
  return {
    ...sequentialDecision(
      likelihoodRatio,
      Math.min(input.controlSamples, input.treatmentSamples),
      alpha,
      beta,
    ),
    likelihoodRatio,
    controlRate,
    treatmentRate,
    lift: controlRate > 0 ? (treatmentRate - controlRate) / controlRate : 0,
  };
}

export function evaluateContinuousMsprt(input: {
  metric: Extract<ExperimentMetric, "cpa" | "roas" | "cost_per_lead">;
  controlMean: number;
  controlStandardDeviation: number;
  controlSamples: number;
  treatmentMean: number;
  treatmentStandardDeviation: number;
  treatmentSamples: number;
  relativeMde: number;
  alpha?: number;
  beta?: number;
}) {
  const direction = experimentMetricDirection(input.metric);
  const rawDifference = input.treatmentMean - input.controlMean;
  const improvement = direction === "lower" ? -rawDifference : rawDifference;
  const standardError = Math.sqrt(
    Math.max(
      1e-12,
      input.controlStandardDeviation ** 2 / input.controlSamples +
        input.treatmentStandardDeviation ** 2 / input.treatmentSamples,
    ),
  );
  const priorScale = Math.max(
    1e-6,
    Math.abs(input.controlMean * input.relativeMde),
  );
  const likelihoodRatio = normalMixtureLikelihoodRatio({
    improvement,
    standardError,
    priorScale,
  });
  const decision = sequentialDecision(
    likelihoodRatio,
    Math.min(input.controlSamples, input.treatmentSamples),
    input.alpha || 0.05,
    input.beta || 0.2,
  );
  return {
    ...decision,
    likelihoodRatio,
    controlValue: input.controlMean,
    treatmentValue: input.treatmentMean,
    lift:
      input.controlMean !== 0 ? improvement / Math.abs(input.controlMean) : 0,
  };
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export type ExperimentSegmentResult = {
  segment: string;
  controlValue: number;
  treatmentValue: number;
  lift: number;
  samples: number;
};
export type ExperimentResultDashboard = {
  metric: ExperimentMetric;
  metricFamily: "binary" | "continuous";
  metricDirection: "higher" | "lower";
  lift: number;
  confidenceInterval: [number, number];
  pValue: number;
  sampleSize: number;
  segments: ExperimentSegmentResult[];
  recommendation: "ship" | "kill" | "iterate";
};

function resultRecommendation(pValue: number, lift: number) {
  return pValue < 0.05 && lift > 0
    ? ("ship" as const)
    : pValue < 0.05 && lift < 0
      ? ("kill" as const)
      : ("iterate" as const);
}

export function buildExperimentResultDashboard(input: {
  metric?: Extract<ExperimentMetric, "ctr" | "conversion_rate">;
  controlSuccesses: number;
  controlSamples: number;
  treatmentSuccesses: number;
  treatmentSamples: number;
  segments?: Array<{
    segment: string;
    controlSuccesses: number;
    controlSamples: number;
    treatmentSuccesses: number;
    treatmentSamples: number;
  }>;
}): ExperimentResultDashboard {
  const controlRate =
    input.controlSamples > 0
      ? input.controlSuccesses / input.controlSamples
      : 0;
  const treatmentRate =
    input.treatmentSamples > 0
      ? input.treatmentSuccesses / input.treatmentSamples
      : 0;
  const difference = treatmentRate - controlRate;
  const standardError = Math.sqrt(
    Math.max(
      1e-12,
      (controlRate * (1 - controlRate)) / Math.max(1, input.controlSamples) +
        (treatmentRate * (1 - treatmentRate)) /
          Math.max(1, input.treatmentSamples),
    ),
  );
  const zScore = difference / standardError;
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(zScore))));
  const denominator = Math.max(1e-12, Math.abs(controlRate));
  const confidenceInterval: [number, number] = [
    (difference - 1.96 * standardError) / denominator,
    (difference + 1.96 * standardError) / denominator,
  ];
  const lift = controlRate > 0 ? difference / controlRate : 0;
  return {
    metric: input.metric || "conversion_rate",
    metricFamily: "binary",
    metricDirection: "higher",
    lift,
    confidenceInterval,
    pValue,
    sampleSize: input.controlSamples + input.treatmentSamples,
    segments: (input.segments || []).map((segment) => {
      const segmentControlRate =
        segment.controlSamples > 0
          ? segment.controlSuccesses / segment.controlSamples
          : 0;
      const segmentTreatmentRate =
        segment.treatmentSamples > 0
          ? segment.treatmentSuccesses / segment.treatmentSamples
          : 0;
      return {
        segment: segment.segment,
        controlValue: segmentControlRate,
        treatmentValue: segmentTreatmentRate,
        lift:
          segmentControlRate > 0
            ? (segmentTreatmentRate - segmentControlRate) / segmentControlRate
            : 0,
        samples: segment.controlSamples + segment.treatmentSamples,
      };
    }),
    recommendation: resultRecommendation(pValue, lift),
  };
}

type ContinuousSegmentInput = {
  segment: string;
  controlMean: number;
  controlStandardDeviation: number;
  controlSamples: number;
  treatmentMean: number;
  treatmentStandardDeviation: number;
  treatmentSamples: number;
};

export function buildContinuousExperimentResultDashboard(input: {
  metric: Extract<ExperimentMetric, "cpa" | "roas" | "cost_per_lead">;
  controlMean: number;
  controlStandardDeviation: number;
  controlSamples: number;
  treatmentMean: number;
  treatmentStandardDeviation: number;
  treatmentSamples: number;
  segments?: ContinuousSegmentInput[];
}): ExperimentResultDashboard {
  const metricDirection = experimentMetricDirection(input.metric);
  const rawDifference = input.treatmentMean - input.controlMean;
  const improvement =
    metricDirection === "lower" ? -rawDifference : rawDifference;
  const standardError = Math.sqrt(
    Math.max(
      1e-12,
      input.controlStandardDeviation ** 2 / Math.max(1, input.controlSamples) +
        input.treatmentStandardDeviation ** 2 /
          Math.max(1, input.treatmentSamples),
    ),
  );
  const zScore = improvement / standardError;
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(zScore))));
  const denominator = Math.max(1e-12, Math.abs(input.controlMean));
  const confidenceInterval: [number, number] = [
    (improvement - 1.96 * standardError) / denominator,
    (improvement + 1.96 * standardError) / denominator,
  ];
  const lift = improvement / denominator;
  return {
    metric: input.metric,
    metricFamily: "continuous",
    metricDirection,
    lift,
    confidenceInterval,
    pValue,
    sampleSize: input.controlSamples + input.treatmentSamples,
    segments: (input.segments || []).map((segment) => {
      const segmentDifference = segment.treatmentMean - segment.controlMean;
      const segmentImprovement =
        metricDirection === "lower" ? -segmentDifference : segmentDifference;
      return {
        segment: segment.segment,
        controlValue: segment.controlMean,
        treatmentValue: segment.treatmentMean,
        lift:
          segment.controlMean !== 0
            ? segmentImprovement / Math.abs(segment.controlMean)
            : 0,
        samples: segment.controlSamples + segment.treatmentSamples,
      };
    }),
    recommendation: resultRecommendation(pValue, lift),
  };
}

export type ExperimentLogEntry = {
  id: string;
  definition: ExperimentDefinition;
  result?: ExperimentResultDashboard;
  tags: string[];
  learning?: string;
  createdAt: string;
  updatedAt: string;
};

const experimentLog: ExperimentLogEntry[] = [];

export function learningTags(
  definition: ExperimentDefinition,
  result?: ExperimentResultDashboard,
) {
  const text =
    `${definition.hypothesis} ${definition.metric}`.toLocaleLowerCase();
  return Array.from(
    new Set([
      definition.metric,
      ...(/ugc/u.test(text) ? ["ugc"] : []),
      ...(/studio/u.test(text) ? ["studio"] : []),
      ...(/hook/u.test(text) ? ["hook"] : []),
      ...(/offer|discount|promo/u.test(text) ? ["offer"] : []),
      ...(result ? [result.recommendation] : []),
    ]),
  );
}

export function saveExperimentLog(input: {
  definition: ExperimentDefinition;
  result?: ExperimentResultDashboard;
}) {
  const now = new Date().toISOString();
  const existing = experimentLog.find(
    (entry) => entry.id === input.definition.id,
  );
  const lift = input.result
    ? `${Math.abs(input.result.lift * 100).toFixed(1)}%`
    : undefined;
  const learning = input.result
    ? `${input.definition.hypothesis}: ${input.result.recommendation} with ${lift} ${input.result.lift >= 0 ? "lift" : "decline"}.`
    : undefined;
  const entry: ExperimentLogEntry = {
    id: input.definition.id,
    definition: input.definition,
    result: input.result,
    tags: learningTags(input.definition, input.result),
    learning,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const index = experimentLog.findIndex((item) => item.id === entry.id);
  if (index >= 0) experimentLog[index] = entry;
  else experimentLog.unshift(entry);
  return entry;
}

export function searchExperimentLog(query = "") {
  const needle = query.trim().toLocaleLowerCase();
  return experimentLog.filter(
    (entry) =>
      !needle ||
      `${entry.definition.hypothesis} ${entry.learning || ""} ${entry.tags.join(" ")}`
        .toLocaleLowerCase()
        .includes(needle),
  );
}
