import type { SpendResponseCurve } from "@/lib/budget-allocator";

export type PacingCurve = "linear" | "front_loaded" | "custom";
export type PacingCadence = "daily" | "weekly" | "monthly";

export type PacingPlan = {
  cadence: PacingCadence;
  curve: PacingCurve;
  totalBudget: number;
  startDate: string;
  endDate: string;
  targets: Array<{ date: string; targetSpend: number; cumulativeTarget: number }>;
};

function dateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dates: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(cursor.toISOString().slice(0, 10));
  return dates;
}

export function buildPacingPlan(input: { cadence: PacingCadence; curve: PacingCurve; totalBudget: number; startDate: string; endDate: string; customWeights?: number[] }): PacingPlan {
  const dates = dateRange(input.startDate, input.endDate);
  if (!dates.length) throw new Error("Pacing window must contain at least one day.");
  if (input.curve === "custom" && input.customWeights?.length !== dates.length) {
    throw new Error(`Custom pacing requires exactly ${dates.length} daily weights.`);
  }
  const rawWeights = input.curve === "front_loaded"
    ? dates.map((_date, index) => Math.max(0.35, 1.6 - index / Math.max(1, dates.length - 1)))
    : input.curve === "custom"
      ? input.customWeights!.map((weight) => Math.max(0, weight))
      : dates.map(() => 1);
  const weightTotal = rawWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) throw new Error("Pacing weights must include at least one positive value.");
  let cumulativeTarget = 0;
  const targets = dates.map((date, index) => {
    const targetSpend = input.totalBudget * rawWeights[index] / weightTotal;
    cumulativeTarget += targetSpend;
    return { date, targetSpend, cumulativeTarget };
  });
  return { cadence: input.cadence, curve: input.curve, totalBudget: input.totalBudget, startDate: input.startDate, endDate: input.endDate, targets };
}

export function assessPacing(input: { plan: PacingPlan; actualSpend: number; asOfDate: string }) {
  const elapsedTargets = input.plan.targets.filter((target) => target.date <= input.asOfDate);
  const targetToDate = elapsedTargets.at(-1)?.cumulativeTarget || 0;
  const targetShare = input.plan.totalBudget > 0 ? targetToDate / input.plan.totalBudget : 0;
  const projectedEndSpend = targetShare > 0 ? input.actualSpend / targetShare : 0;
  const deviation = input.plan.totalBudget > 0 ? (projectedEndSpend - input.plan.totalBudget) / input.plan.totalBudget : 0;
  const status = deviation > 0.1 ? "overspend" : deviation < -0.1 ? "underspend" : "on_pace";
  const recommendedDailyBudget = Math.max(0, (input.plan.totalBudget - input.actualSpend) / Math.max(1, input.plan.targets.length - elapsedTargets.length));
  return { status, targetToDate, actualSpend: input.actualSpend, varianceToDate: input.actualSpend - targetToDate, projectedEndSpend, deviation, alert: Math.abs(deviation) > 0.1, recommendedDailyBudget };
}

export function pacingAlertMessage(input: { account: string; assessment: ReturnType<typeof assessPacing>; currency?: string }) {
  const currency = input.currency || "USD";
  const format = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  return `[${input.assessment.status.toUpperCase()}] ${input.account}: projected ${format(input.assessment.projectedEndSpend)} (${(input.assessment.deviation * 100).toFixed(1)}% vs plan). Recommended remaining daily budget: ${format(input.assessment.recommendedDailyBudget)}.`;
}

export async function deliverPacingAlert(input: { message: string; slackWebhook?: string; emailWebhook?: string }) {
  const deliveries: Array<{ channel: "slack" | "email"; ok: boolean; status?: number; error?: string }> = [];
  if (input.slackWebhook) {
    try {
      const response = await fetch(input.slackWebhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: input.message }) });
      deliveries.push({ channel: "slack", ok: response.ok, status: response.status });
    } catch (error) {
      deliveries.push({ channel: "slack", ok: false, error: error instanceof Error ? error.message : "Slack delivery failed." });
    }
  }
  if (input.emailWebhook) {
    try {
      const response = await fetch(input.emailWebhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: "Decision Workspace pacing alert", text: input.message }) });
      deliveries.push({ channel: "email", ok: response.ok, status: response.status });
    } catch (error) {
      deliveries.push({ channel: "email", ok: false, error: error instanceof Error ? error.message : "Email delivery failed." });
    }
  }
  return deliveries;
}

export type BudgetCapCampaign = { id: string; platform: string; spend: number; cap: number; roas: number; active: boolean; dailyBudget?: number };

export function enforcePlatformCaps(campaigns: BudgetCapCampaign[]) {
  const stopped = campaigns.filter((campaign) => campaign.active && campaign.spend >= campaign.cap);
  const available = campaigns.filter((campaign) => campaign.active && campaign.spend < campaign.cap).sort((left, right) => right.roas - left.roas);
  const redistribute = stopped.reduce((sum, campaign) => sum + Math.max(0, (campaign.dailyBudget || campaign.spend) - campaign.spend), 0);
  return { stopped: stopped.map((campaign) => campaign.id), redistribute, nextBestCampaignId: available[0]?.id, nextBestRoas: available[0]?.roas || 0 };
}

export type DaypartRule = { day: number; startHour: number; endHour: number; bidMultiplier: number };

export function bidMultiplierAt(rules: DaypartRule[], date: Date) {
  const rule = rules.find((item) => item.day === date.getUTCDay() && date.getUTCHours() >= item.startHour && date.getUTCHours() < item.endHour);
  return rule?.bidMultiplier ?? 1;
}

export type HierarchicalSpendCampaign = {
  campaignId: string;
  platform: string;
  spend: number;
  revenue: number;
  observations?: Array<{ date?: string; spend: number; revenue: number }>;
};

export type HierarchicalCampaignDiagnostic = {
  campaignId: string;
  platform: string;
  observationCount: number;
  observedRoas: number;
  posteriorRoas: number;
  posteriorLogRoasSd: number;
  priorWeight: number;
};

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function sampleVariance(values: number[], center = mean(values)) {
  if (values.length < 2) return 0;
  return values.reduce((sum, value) => sum + (value - center) ** 2, 0) /
    (values.length - 1);
}

function logRoas(spend: number, revenue: number) {
  return Math.log((Math.max(0, revenue) + 1) / (Math.max(0, spend) + 1));
}

export function estimateBayesianHierarchicalSpendCurves(
  input: HierarchicalSpendCampaign[],
) {
  const campaigns = input.map((campaign) => {
    const observations = campaign.observations?.length
      ? campaign.observations
      : [{ spend: campaign.spend, revenue: campaign.revenue }];
    const values = observations.map((row) => logRoas(row.spend, row.revenue));
    return { campaign, values, sampleMean: mean(values) };
  });
  const campaignMeans = campaigns.map((campaign) => campaign.sampleMean);
  const priorMean = mean(campaignMeans);
  const allValues = campaigns.flatMap((campaign) => campaign.values);
  const observationVariance = Math.max(sampleVariance(allValues), 0.09);
  const betweenCampaignVariance = Math.max(
    sampleVariance(campaignMeans, priorMean),
    0.04,
  );
  const diagnostics: HierarchicalCampaignDiagnostic[] = [];
  const curves = campaigns.map(({ campaign, values, sampleMean }) => {
    const samplingVariance = observationVariance / Math.max(1, values.length);
    const dataWeight =
      betweenCampaignVariance /
      (betweenCampaignVariance + samplingVariance);
    const posteriorMean =
      priorMean * (1 - dataWeight) + sampleMean * dataWeight;
    const posteriorVariance =
      (betweenCampaignVariance * samplingVariance) /
      (betweenCampaignVariance + samplingVariance);
    const posteriorRoas = Math.max(0, Math.exp(posteriorMean));
    const observedRoas =
      campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
    diagnostics.push({
      campaignId: campaign.campaignId,
      platform: campaign.platform,
      observationCount: values.length,
      observedRoas,
      posteriorRoas,
      posteriorLogRoasSd: Math.sqrt(posteriorVariance),
      priorWeight: 1 - dataWeight,
    });
    const current = Math.max(1, campaign.spend);
    return {
      id: campaign.campaignId,
      platform: campaign.platform,
      currentSpend: campaign.spend,
      currentRevenue: campaign.revenue,
      minSpend: Math.max(0, current * 0.5),
      maxSpend: current * 2,
      curve: [
        { spend: current * 0.5, revenue: current * 0.5 * posteriorRoas * 1.05 },
        { spend: current, revenue: current * posteriorRoas },
        { spend: current * 1.5, revenue: current * 1.5 * posteriorRoas * 0.88 },
        { spend: current * 2, revenue: current * 2 * posteriorRoas * 0.72 },
      ],
    } satisfies SpendResponseCurve;
  });
  return {
    curves,
    diagnostics,
    model: {
      kind: "bayesian_hierarchical_log_roas" as const,
      likelihood: "normal" as const,
      prior: "normal" as const,
      priorMeanLogRoas: priorMean,
      betweenCampaignVariance,
      observationVariance,
    },
  };
}

export function estimateHierarchicalSpendCurves(
  input: HierarchicalSpendCampaign[],
): SpendResponseCurve[] {
  return estimateBayesianHierarchicalSpendCurves(input).curves;
}

export function recommendBidStrategy(input: { cpaHistory: number[]; roasHistory: number[]; targetCpa?: number; targetRoas?: number }) {
  const values = input.cpaHistory.length ? input.cpaHistory : input.roasHistory;
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const volatility = mean > 0 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length)) / mean : 0;
  const strategy = input.targetRoas && input.roasHistory.length >= 7 && volatility < 0.35 ? "target_roas"
    : input.targetCpa && input.cpaHistory.length >= 7 && volatility < 0.35 ? "cost_cap"
      : "lowest_cost";
  return { strategy, volatility, rationale: strategy === "lowest_cost" ? "History is too sparse or volatile for a stable cap/target." : `Historical volatility ${(volatility * 100).toFixed(1)}% supports ${strategy.replace("_", " ")}.` };
}

export function bidRule(input: { actualCpa: number; targetCpa: number; currentBid: number }) {
  if (input.actualCpa < input.targetCpa * 0.8) return { action: "increase" as const, multiplier: 1.1, nextBid: input.currentBid * 1.1 };
  if (input.actualCpa > input.targetCpa * 1.2) return { action: "decrease" as const, multiplier: 0.85, nextBid: input.currentBid * 0.85 };
  return { action: "hold" as const, multiplier: 1, nextBid: input.currentBid };
}

export function learningPhaseProtection(input: { learningStatus?: string; requestedChangePercent: number }) {
  const learning = input.learningStatus === "LEARNING" || input.learningStatus === "LEARNING_LIMITED";
  if (learning) return { allowed: false, frozen: true, resumeWhen: "learning_exit", reason: "Budget and bid changes are frozen during the platform learning phase." };
  return { allowed: Math.abs(input.requestedChangePercent) <= 20, frozen: false, resumeWhen: undefined, reason: Math.abs(input.requestedChangePercent) <= 20 ? "Change is inside the 20% learning-stability guardrail." : "Requested change exceeds the 20% learning-stability guardrail." };
}
