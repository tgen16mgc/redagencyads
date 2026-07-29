export type SpendResponseCurve = {
  id: string;
  platform: string;
  currentSpend: number;
  currentRevenue: number;
  minSpend: number;
  maxSpend: number;
  minRoas?: number;
  curve: Array<{ spend: number; revenue: number }>;
};

export type AllocationResult = {
  allocations: Array<{
    id: string;
    platform: string;
    spend: number;
    projectedRevenue: number;
    marginalRoas: number;
  }>;
  totalSpend: number;
  projectedRevenue: number;
  projectedRoas: number;
  warnings: string[];
  optimization: {
    solver: "piecewise_linear_program";
    objective: "maximize_projected_revenue";
    status: "optimal" | "bounded";
    totalBudget: number;
    budgetGap: number;
    variableCount: number;
    constraintCount: number;
  };
};

export type PlatformCpmShock = { platform: string; multiplier: number };

function interpolate(curve: SpendResponseCurve["curve"], spend: number) {
  const points = curve.slice().sort((left, right) => left.spend - right.spend);
  if (!points.length) return 0;
  if (spend <= points[0].spend) return points[0].revenue;
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (spend <= right.spend) {
      const share =
        (spend - left.spend) / Math.max(1, right.spend - left.spend);
      return left.revenue + (right.revenue - left.revenue) * share;
    }
  }
  return points[points.length - 1].revenue;
}

export function marginalRoas(
  curve: SpendResponseCurve,
  spend: number,
  step = 1000,
) {
  const before = interpolate(curve.curve, spend);
  const nextSpend = Math.min(curve.maxSpend, spend + step);
  const after = interpolate(curve.curve, nextSpend);
  return after > before && nextSpend > spend
    ? (after - before) / (nextSpend - spend)
    : 0;
}

function linearSegments(curve: SpendResponseCurve) {
  const points = Array.from(
    new Set([
      curve.minSpend,
      curve.maxSpend,
      ...curve.curve
        .map((point) => point.spend)
        .filter((spend) => spend > curve.minSpend && spend < curve.maxSpend),
    ]),
  ).sort((left, right) => left - right);
  return points
    .slice(1)
    .map((end, index) => {
      const start = points[index];
      const capacity = end - start;
      return {
        start,
        end,
        capacity,
        marginalRoas:
          capacity > 0
            ? (interpolate(curve.curve, end) -
                interpolate(curve.curve, start)) /
              capacity
            : 0,
      };
    })
    .filter((segment) => segment.capacity > 0);
}

function validatedCurve(curve: SpendResponseCurve, warnings: string[]) {
  if (curve.minSpend < 0 || curve.maxSpend < curve.minSpend)
    throw new Error(
      `${curve.id}: minSpend must be nonnegative and no greater than maxSpend.`,
    );
  if (curve.curve.length < 2)
    throw new Error(
      `${curve.id}: at least two response-curve points are required.`,
    );
  const points = curve.curve
    .slice()
    .sort((left, right) => left.spend - right.spend);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (
      !Number.isFinite(point.spend) ||
      !Number.isFinite(point.revenue) ||
      point.spend < 0 ||
      point.revenue < 0
    )
      throw new Error(
        `${curve.id}: response-curve points must be finite and nonnegative.`,
      );
    if (index > 0 && point.spend === points[index - 1].spend)
      throw new Error(
        `${curve.id}: response-curve spend points must be unique.`,
      );
    if (index > 0 && point.revenue < points[index - 1].revenue)
      throw new Error(
        `${curve.id}: projected revenue must not decrease as spend increases.`,
      );
  }
  const segments = linearSegments({ ...curve, curve: points });
  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index].marginalRoas > segments[index - 1].marginalRoas + 1e-9)
      throw new Error(
        `${curve.id}: response curve must have non-increasing marginal ROAS for exact piecewise-linear optimization.`,
      );
  }
  if (curve.minRoas === undefined) return { ...curve, curve: points };
  const minimumRevenue = interpolate(points, curve.minSpend);
  if (
    curve.minSpend > 0 &&
    minimumRevenue / curve.minSpend + 1e-9 < curve.minRoas
  )
    throw new Error(
      `${curve.id}: minimum spend violates the ${curve.minRoas}x minimum ROAS constraint.`,
    );
  let effectiveMaxSpend = curve.maxSpend;
  for (const segment of segments) {
    const startGap =
      interpolate(points, segment.start) - curve.minRoas * segment.start;
    const endGap =
      interpolate(points, segment.end) - curve.minRoas * segment.end;
    if (startGap >= 0 && endGap < 0) {
      const share = startGap / Math.max(1e-12, startGap - endGap);
      effectiveMaxSpend = segment.start + (segment.end - segment.start) * share;
      break;
    }
  }
  if (effectiveMaxSpend < curve.maxSpend - 1e-9)
    warnings.push(
      `${curve.id} max spend was limited to ${effectiveMaxSpend.toLocaleString("en-US")} by its ${curve.minRoas}x minimum ROAS constraint.`,
    );
  return { ...curve, curve: points, maxSpend: effectiveMaxSpend };
}

export function allocateBudget(input: {
  totalBudget: number;
  curves: SpendResponseCurve[];
  step?: number;
}): AllocationResult {
  const reportingStep = Math.max(1, input.step || 1000);
  const warnings: string[] = [];
  const requestedMinimumSpend = input.curves.reduce(
    (sum, curve) => sum + curve.minSpend,
    0,
  );
  if (requestedMinimumSpend > input.totalBudget) {
    throw new Error(
      `Budget allocation is infeasible: minimum spends total ${requestedMinimumSpend.toLocaleString("en-US")}, above the ${input.totalBudget.toLocaleString("en-US")} budget.`,
    );
  }
  const boundedCurves = input.curves.map((curve) =>
    validatedCurve(curve, warnings),
  );
  const allocations = boundedCurves.map((curve) => ({
    ...curve,
    spend: curve.minSpend,
    segmentIndex: 0,
    segments: linearSegments(curve),
  }));
  let totalSpend = allocations.reduce((sum, item) => sum + item.spend, 0);
  if (totalSpend > input.totalBudget) {
    throw new Error(
      `Budget allocation is infeasible: minimum spends total ${totalSpend.toLocaleString("en-US")}, above the ${input.totalBudget.toLocaleString("en-US")} budget.`,
    );
  }

  let iterations = 0;
  while (totalSpend < input.totalBudget) {
    const candidates = allocations
      .map((item) => ({ item, segment: item.segments[item.segmentIndex] }))
      .filter(({ segment }) => Boolean(segment))
      .sort(
        (left, right) => right.segment.marginalRoas - left.segment.marginalRoas,
      );
    const winner = candidates[0];
    if (!winner || winner.segment.marginalRoas <= 0) break;
    const segmentUsed = winner.item.spend - winner.segment.start;
    const allocation = Math.min(
      winner.segment.capacity - segmentUsed,
      input.totalBudget - totalSpend,
    );
    if (allocation <= 0) {
      winner.item.segmentIndex += 1;
      continue;
    }
    winner.item.spend += allocation;
    totalSpend += allocation;
    iterations += 1;
    if (winner.item.spend >= winner.segment.end - Number.EPSILON)
      winner.item.segmentIndex += 1;
  }
  if (totalSpend < input.totalBudget)
    warnings.push(
      `Only ${totalSpend.toLocaleString("en-US")} could be allocated within max-spend and minimum-ROAS constraints.`,
    );
  const results = allocations.map((item) => {
    const projectedRevenue = interpolate(item.curve, item.spend);
    return {
      id: item.id,
      platform: item.platform,
      spend: item.spend,
      projectedRevenue,
      marginalRoas: marginalRoas(item, item.spend, reportingStep),
    };
  });
  const projectedRevenue = results.reduce(
    (sum, item) => sum + item.projectedRevenue,
    0,
  );
  return {
    allocations: results,
    totalSpend,
    projectedRevenue,
    projectedRoas: totalSpend > 0 ? projectedRevenue / totalSpend : 0,
    warnings,
    optimization: {
      solver: "piecewise_linear_program",
      objective: "maximize_projected_revenue",
      status:
        totalSpend >= input.totalBudget - Number.EPSILON
          ? "optimal"
          : "bounded",
      totalBudget: input.totalBudget,
      budgetGap: Math.max(0, input.totalBudget - totalSpend),
      variableCount: allocations.reduce(
        (sum, item) => sum + item.segments.length,
        0,
      ),
      constraintCount:
        1 +
        allocations.length * 2 +
        input.curves.filter((curve) => curve.minRoas !== undefined).length,
    },
  };
}

export function scenarioBudget(
  curves: SpendResponseCurve[],
  multiplier: number,
) {
  return allocateBudget({
    totalBudget:
      curves.reduce((sum, curve) => sum + curve.currentSpend, 0) * multiplier,
    curves,
  });
}

export function applyPlatformCpmShocks(
  curves: SpendResponseCurve[],
  shocks: PlatformCpmShock[],
) {
  const byPlatform = new Map(
    shocks.map((shock) => [shock.platform, Math.max(0.01, shock.multiplier)]),
  );
  return curves.map((curve) => {
    const multiplier = byPlatform.get(curve.platform);
    if (!multiplier || multiplier === 1)
      return { ...curve, curve: curve.curve.map((point) => ({ ...point })) };
    return {
      ...curve,
      currentRevenue: curve.currentRevenue / multiplier,
      curve: curve.curve.map((point) => ({
        ...point,
        revenue: point.revenue / multiplier,
      })),
    };
  });
}

export function scenarioWithPlatformShocks(input: {
  curves: SpendResponseCurve[];
  totalBudget: number;
  shocks?: PlatformCpmShock[];
  step?: number;
}) {
  const shocks = input.shocks || [];
  const result = allocateBudget({
    totalBudget: input.totalBudget,
    curves: applyPlatformCpmShocks(input.curves, shocks),
    step: input.step,
  });
  return {
    ...result,
    assumptions: shocks.map(
      (shock) => `${shock.platform} CPM ×${shock.multiplier.toFixed(2)}`,
    ),
  };
}
