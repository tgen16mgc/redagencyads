"use client";

import * as React from "react";
import {
  CalendarClockIcon,
  GaugeIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TimerResetIcon,
  WaypointsIcon,
} from "lucide-react";
import type {
  AllocationResult,
  SpendResponseCurve,
} from "@/lib/budget-allocator";
import {
  bidMultiplierAt,
  enforcePlatformCaps,
  type DaypartRule,
  type PacingPlan,
} from "@/lib/budget-automation";
import { jsonFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type PacingResponse = {
  plan: PacingPlan;
  assessment: {
    status: string;
    projectedEndSpend: number;
    deviation: number;
    recommendedDailyBudget: number;
  };
  protection?: { allowed: boolean; reason: string };
  audit?: { status: string };
};
type ScenarioResult = AllocationResult & { assumptions?: string[] };
type Platform = "meta" | "tiktok" | "google_ads";
type BidStrategyResult = {
  strategy: string;
  volatility: number;
  rationale: string;
};
type CapCampaign = {
  id: string;
  platform: Platform;
  spend: number;
  cap: number;
  roas: number;
  active: boolean;
  dailyBudget?: number;
  budgetId?: string;
  learningStatus?: string;
};

function Metric({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {badge ? (
        <Badge className="mt-2" variant="secondary">
          {value}
        </Badge>
      ) : (
        <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      )}
    </div>
  );
}

function numberSeries(value: string) {
  const values = value
    .split(/[\s,]+/u)
    .filter(Boolean)
    .map(Number);
  if (values.some((item) => !Number.isFinite(item) || item < 0))
    throw new Error(
      "History and custom weights must be non-negative numbers separated by commas.",
    );
  return values;
}

export function BudgetOperations({ language }: { language: "en" | "vi" }) {
  const isVietnamese = language === "vi";
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const monthEnd = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);
  const [budget, setBudget] = React.useState(100000);
  const [actualSpend, setActualSpend] = React.useState(42000);
  const [pacingCadence, setPacingCadence] =
    React.useState<PacingPlan["cadence"]>("monthly");
  const [pacingCurve, setPacingCurve] =
    React.useState<PacingPlan["curve"]>("linear");
  const [pacingStartDate, setPacingStartDate] = React.useState(monthStart);
  const [pacingEndDate, setPacingEndDate] = React.useState(monthEnd);
  const [customWeights, setCustomWeights] = React.useState("");
  const [pacing, setPacing] = React.useState<PacingResponse | null>(null);
  const [pacingMessage, setPacingMessage] = React.useState("");
  const [allocation, setAllocation] = React.useState<ScenarioResult | null>(
    null,
  );
  const [scenarioLabel, setScenarioLabel] = React.useState("");
  const [modelCurves, setModelCurves] = React.useState<SpendResponseCurve[]>(
    [],
  );
  const [modelGeneratedAt, setModelGeneratedAt] = React.useState("");
  const [targetCpa, setTargetCpa] = React.useState(100);
  const [actualCpa, setActualCpa] = React.useState(75);
  const [currentBid, setCurrentBid] = React.useState(100);
  const [targetRoas, setTargetRoas] = React.useState(2.5);
  const [cpaHistory, setCpaHistory] = React.useState(
    "92, 95, 91, 94, 90, 93, 92",
  );
  const [roasHistory, setRoasHistory] = React.useState(
    "2.4, 2.5, 2.6, 2.5, 2.7, 2.6, 2.5",
  );
  const [bidResult, setBidResult] = React.useState<{
    action: string;
    nextBid: number;
    protection: { allowed: boolean; reason: string };
  } | null>(null);
  const [strategyResult, setStrategyResult] =
    React.useState<BidStrategyResult | null>(null);
  const [capResult, setCapResult] = React.useState<ReturnType<
    typeof enforcePlatformCaps
  > | null>(null);
  const [capsJson, setCapsJson] = React.useState("[]");
  const [daypartRules, setDaypartRules] = React.useState<DaypartRule[]>([
    {
      day: new Date().getUTCDay(),
      startHour: 9,
      endHour: 18,
      bidMultiplier: 1.1,
    },
  ]);
  const [daypartTarget, setDaypartTarget] = React.useState("adset-1");
  const [daypartResult, setDaypartResult] = React.useState<{
    status?: string;
    previewMultiplier?: number;
  } | null>(null);
  const [actionTarget, setActionTarget] = React.useState("campaign-1");
  const [actionCampaignId, setActionCampaignId] = React.useState("");
  const [actionPlatform, setActionPlatform] = React.useState<Platform>("meta");
  const [actionCurrentBudget, setActionCurrentBudget] = React.useState(100);
  const [actionBudget, setActionBudget] = React.useState(110);
  const [learningStatus, setLearningStatus] = React.useState("NOT_LEARNING");
  const [actionMessage, setActionMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const money = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);

  React.useEffect(() => {
    void jsonFetch<{
      snapshot: { generatedAt: string; curves: SpendResponseCurve[] } | null;
    }>("/api/budget/models", { timeoutMs: 8000 })
      .then((data) => {
        setModelCurves(data.snapshot?.curves || []);
        setModelGeneratedAt(data.snapshot?.generatedAt || "");
      })
      .catch(() => undefined);
  }, []);

  async function runPacing(apply: boolean) {
    setError("");
    setPacingMessage("");
    try {
      const data = await jsonFetch<PacingResponse>("/api/budget/pacing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cadence: pacingCadence,
          curve: pacingCurve,
          totalBudget: budget,
          startDate: pacingStartDate,
          endDate: pacingEndDate,
          customWeights:
            pacingCurve === "custom" ? numberSeries(customWeights) : undefined,
          actualSpend,
          asOfDate: today,
          apply,
          ...(apply
            ? {
                platform: actionPlatform,
                targetId: actionTarget,
                campaignId:
                  actionPlatform === "google_ads"
                    ? actionCampaignId
                    : undefined,
                currentDailyBudget: actionCurrentBudget,
                learningStatus,
              }
            : {}),
        }),
        timeoutMs: 10000,
      });
      setPacing(data);
      setPacingMessage(
        apply
          ? `Pacing action ${data.audit?.status || (data.protection?.allowed ? "applied" : "reviewed")}. ${data.protection?.reason || ""}`
          : "Pacing assessment refreshed.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pacing failed.");
    }
  }

  async function runAllocation(scenario: "budget_up" | "tiktok_cpm") {
    setError("");
    if (!modelCurves.length) {
      setAllocation(null);
      setError(
        "No owned-performance response curves are available. Sync connector data and run the daily budget model first.",
      );
      return;
    }
    const curves = modelCurves;
    const totalBudget = scenario === "budget_up" ? budget * 1.2 : budget;
    const cpmShocks =
      scenario === "tiktok_cpm"
        ? [{ platform: "tiktok", multiplier: 1.3 }]
        : [];
    try {
      const data = await jsonFetch<{ result: ScenarioResult }>(
        "/api/budget/allocate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            totalBudget,
            step: Math.max(1000, budget * 0.01),
            curves,
            cpmShocks,
          }),
          timeoutMs: 8000,
        },
      );
      setAllocation(data.result);
      setScenarioLabel(
        scenario === "budget_up" ? "Budget +20%" : "Owned TikTok CPM +30%",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Allocation failed.");
    }
  }

  async function runBidRule() {
    setError("");
    try {
      const data = await jsonFetch<{
        result: { action: string; nextBid: number };
        protection: { allowed: boolean; reason: string };
      }>("/api/budget/bids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "rule",
          actualCpa,
          targetCpa,
          currentBid,
          learningStatus,
        }),
        timeoutMs: 8000,
      });
      setBidResult({ ...data.result, protection: data.protection });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bid rule failed.");
    }
  }

  async function runBidStrategy() {
    setError("");
    try {
      const data = await jsonFetch<{ result: BidStrategyResult }>(
        "/api/budget/bids",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            operation: "strategy",
            cpaHistory: numberSeries(cpaHistory),
            roasHistory: numberSeries(roasHistory),
            targetCpa,
            targetRoas,
          }),
          timeoutMs: 8000,
        },
      );
      setStrategyResult(data.result);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Bid strategy recommendation failed.",
      );
    }
  }

  async function runCaps(apply: boolean) {
    setError("");
    try {
      const parsedCampaigns = JSON.parse(capsJson) as unknown;
      if (!Array.isArray(parsedCampaigns) || !parsedCampaigns.length)
        throw new Error(
          "Enter at least one campaign before evaluating platform caps.",
        );
      const campaigns = parsedCampaigns as CapCampaign[];
      const data = await jsonFetch<{
        plan: ReturnType<typeof enforcePlatformCaps>;
        audit?: { status: string };
      }>("/api/budget/caps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaigns, apply }),
        timeoutMs: 10000,
      });
      setCapResult(data.plan);
      setActionMessage(
        `Cap plan ${data.audit?.status || (apply ? "applied" : "planned")}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Cap enforcement failed.",
      );
    }
  }

  async function runDaypart(apply: boolean) {
    setError("");
    try {
      const data = await jsonFetch<{
        previewMultiplier?: number;
        audit?: { status: string };
      }>("/api/budget/daypart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: actionPlatform,
          targetId: daypartTarget,
          rules: daypartRules,
          apply,
        }),
        timeoutMs: 10000,
      });
      setDaypartResult({
        previewMultiplier: data.previewMultiplier,
        status: data.audit?.status || (apply ? "applied" : "planned"),
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Daypart action failed.",
      );
    }
  }

  async function stageBudget(apply: boolean) {
    setActionMessage("");
    try {
      const data = await jsonFetch<{
        audit?: { status: string };
        protection?: { reason: string };
      }>("/api/budget/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: actionPlatform,
          targetId: actionTarget,
          campaignId:
            actionPlatform === "google_ads" ? actionCampaignId : undefined,
          budget: actionBudget,
          currentBudget: actionCurrentBudget,
          learningStatus,
          apply,
        }),
        timeoutMs: 10000,
      });
      setActionMessage(
        `${apply ? "Applied" : "Planned"} · ${data.audit?.status || data.protection?.reason || "ok"}`,
      );
    } catch (reason) {
      setActionMessage(
        reason instanceof Error ? reason.message : "Budget action failed.",
      );
    }
  }

  const directBudgetWriteSupported =
    actionPlatform === "meta" || actionPlatform === "google_ads";

  return (
    <div className="grid min-w-0 gap-4 [&_[data-slot=card-content]]:min-w-0 [&_[data-slot=card]]:min-w-0">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl border bg-background">
              <CalendarClockIcon className="size-4" />
            </span>
            <div>
              <CardTitle>
                {isVietnamese
                  ? "Pacing & spend control"
                  : "Pacing and spend control"}
              </CardTitle>
              <CardDescription>
                Daily/weekly/monthly curves, EOM projection, and ±10%
                guardrails.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel>Cadence</FieldLabel>
                <select
                  value={pacingCadence}
                  onChange={(event) =>
                    setPacingCadence(
                      event.target.value as PacingPlan["cadence"],
                    )
                  }
                  className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field>
                <FieldLabel>Spend curve</FieldLabel>
                <select
                  value={pacingCurve}
                  onChange={(event) =>
                    setPacingCurve(event.target.value as PacingPlan["curve"])
                  }
                  className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
                >
                  <option value="linear">Linear</option>
                  <option value="front_loaded">Front-loaded</option>
                  <option value="custom">Custom daily weights</option>
                </select>
              </Field>
              <Field>
                <FieldLabel>Total budget</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={budget}
                  onChange={(event) => setBudget(Number(event.target.value))}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel>Start date</FieldLabel>
                <Input
                  type="date"
                  value={pacingStartDate}
                  onChange={(event) => setPacingStartDate(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>End date</FieldLabel>
                <Input
                  type="date"
                  value={pacingEndDate}
                  onChange={(event) => setPacingEndDate(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Spend to date</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={actualSpend}
                  onChange={(event) =>
                    setActualSpend(Number(event.target.value))
                  }
                />
              </Field>
            </div>
          </FieldGroup>
          {pacingCurve === "custom" ? (
            <Field>
              <FieldLabel>
                One weight per calendar day, comma separated
              </FieldLabel>
              <Textarea
                value={customWeights}
                onChange={(event) => setCustomWeights(event.target.value)}
                rows={2}
                className="font-mono text-xs"
                placeholder="1, 1, 1, 1, 1, 0.5, 0.5"
              />
            </Field>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void runPacing(false)}
            >
              <GaugeIcon data-icon="inline-start" />
              Assess pacing
            </Button>
            <Button
              type="button"
              disabled={
                !directBudgetWriteSupported ||
                !actionTarget ||
                actionCurrentBudget <= 0
              }
              onClick={() => void runPacing(true)}
            >
              Apply recommended daily budget
            </Button>
            <Badge
              variant="outline"
              className="h-auto max-w-full whitespace-normal text-left"
            >
              Apply uses the staged Meta or Google budget target and learning
              status
            </Badge>
          </div>
          {pacing ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Status" value={pacing.assessment.status} badge />
              <Metric
                label="Projected end spend"
                value={money(pacing.assessment.projectedEndSpend)}
              />
              <Metric
                label="Recommended/day"
                value={money(pacing.assessment.recommendedDailyBudget)}
              />
              <Metric
                label="Plan"
                value={`${pacing.plan.cadence} · ${pacing.plan.curve}`}
              />
            </div>
          ) : null}
          {pacingMessage ? (
            <p className="text-sm text-muted-foreground">{pacingMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ScaleIcon className="size-4" />
              <div>
                <CardTitle>Marginal ROAS allocator</CardTitle>
                <CardDescription>
                  Owned-performance response curves only; public TikTok
                  intelligence is never used for allocation.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={modelCurves.length ? "success" : "outline"}>
                {modelCurves.length
                  ? `${modelCurves.length} refreshed campaign model(s)`
                  : "Awaiting owned performance models"}
              </Badge>
              {modelGeneratedAt ? (
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(modelGeneratedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!modelCurves.length}
                onClick={() => void runAllocation("budget_up")}
              >
                Run +20% budget
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  !modelCurves.some((curve) => curve.platform === "tiktok")
                }
                onClick={() => void runAllocation("tiktok_cpm")}
              >
                TikTok CPM +30%
              </Button>
            </div>
            {allocation ? (
              <div className="mt-4 grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{scenarioLabel}</Badge>
                  {allocation.assumptions?.map((assumption) => (
                    <Badge key={assumption} variant="outline">
                      {assumption}
                    </Badge>
                  ))}
                </div>
                {allocation.allocations.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border p-3 text-sm"
                  >
                    <span>{item.platform}</span>
                    <span className="font-medium tabular-nums">
                      {money(item.spend)} · {item.marginalRoas.toFixed(2)}x
                      marginal
                    </span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">
                  Projected ROAS:{" "}
                  <strong className="text-foreground">
                    {allocation.projectedRoas.toFixed(2)}x
                  </strong>
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="size-4" />
              <div>
                <CardTitle>Bid strategy automation</CardTitle>
                <CardDescription>
                  Historical volatility, CPA rules, and learning-phase
                  protection.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>CPA history</FieldLabel>
                  <Input
                    value={cpaHistory}
                    onChange={(event) => setCpaHistory(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>ROAS history</FieldLabel>
                  <Input
                    value={roasHistory}
                    onChange={(event) => setRoasHistory(event.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Target CPA</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={targetCpa}
                    onChange={(event) =>
                      setTargetCpa(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Target ROAS</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={targetRoas}
                    onChange={(event) =>
                      setTargetRoas(Number(event.target.value))
                    }
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runBidStrategy()}
              >
                Recommend migration strategy
              </Button>
              {strategyResult ? (
                <div className="rounded-xl border p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>Recommended strategy</span>
                    <Badge variant="secondary">
                      {strategyResult.strategy.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Volatility {(strategyResult.volatility * 100).toFixed(1)}%.{" "}
                    {strategyResult.rationale}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="grid gap-4">
              <Separator />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel>Actual CPA</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={actualCpa}
                    onChange={(event) =>
                      setActualCpa(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Target CPA</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={targetCpa}
                    onChange={(event) =>
                      setTargetCpa(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Current bid</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={currentBid}
                    onChange={(event) =>
                      setCurrentBid(Number(event.target.value))
                    }
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runBidRule()}
              >
                Evaluate bid multiplier
              </Button>
              {bidResult ? (
                <div className="rounded-xl border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Action</span>
                    <Badge
                      variant={
                        bidResult.protection.allowed ? "success" : "outline"
                      }
                    >
                      {bidResult.action}
                    </Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Next bid: {money(bidResult.nextBid)}.{" "}
                    {bidResult.protection.reason}
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <TimerResetIcon className="size-4" />
              <div>
                <CardTitle>Daypart and bid schedule</CardTitle>
                <CardDescription>
                  Preview multipliers by hour; Meta and Google writes stay
                  explicit.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field>
              <FieldLabel>
                {actionPlatform === "google_ads"
                  ? "Google campaign ID"
                  : "Meta ad set ID"}
              </FieldLabel>
              <Input
                value={daypartTarget}
                onChange={(event) => setDaypartTarget(event.target.value)}
                placeholder={
                  actionPlatform === "google_ads"
                    ? "campaigns/123456"
                    : "adset-1"
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["day", "Day"],
                  ["startHour", "Start"],
                  ["endHour", "End"],
                  ["bidMultiplier", "Multiplier"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key}>
                  <FieldLabel>{label}</FieldLabel>
                  <Input
                    type="number"
                    value={daypartRules[0][key]}
                    onChange={(event) =>
                      setDaypartRules([
                        {
                          ...daypartRules[0],
                          [key]: Number(event.target.value),
                        },
                      ])
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void runDaypart(false)}
              >
                Dry run
              </Button>
              <Button
                type="button"
                disabled={!directBudgetWriteSupported || !daypartTarget}
                onClick={() => void runDaypart(true)}
              >
                Apply schedule
              </Button>
              <Badge variant="secondary">
                Now: {bidMultiplierAt(daypartRules, new Date()).toFixed(2)}x
              </Badge>
            </div>
            {daypartResult ? (
              <p className="text-xs text-muted-foreground">
                {daypartResult.status} · preview{" "}
                {daypartResult.previewMultiplier?.toFixed(2) || "—"}x
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <WaypointsIcon className="size-4" />
              <div>
                <CardTitle>Platform caps</CardTitle>
                <CardDescription>
                  Paste live campaign rows to preview hard stops and next-best
                  ROAS redistribution.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field>
              <FieldLabel>Campaign payload JSON</FieldLabel>
              <Textarea
                value={capsJson}
                onChange={(event) => setCapsJson(event.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder='[{"id":"campaign-1","platform":"google_ads","budgetId":"campaignBudgets/1","spend":120,"cap":100,"roas":1.2,"active":true,"dailyBudget":100,"learningStatus":"NOT_LEARNING"}]'
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void runCaps(false)}
              >
                Evaluate cap plan
              </Button>
              <Button type="button" onClick={() => void runCaps(true)}>
                Apply connected cap plan
              </Button>
              <Badge
                variant="outline"
                className="h-auto max-w-full whitespace-normal text-left"
              >
                One connected platform per plan; Google redistribution also
                needs budgetId
              </Badge>
            </div>
            {capResult ? (
              <div className="mt-3 grid gap-2 text-sm">
                <p>
                  Stop:{" "}
                  <strong>{capResult.stopped.join(", ") || "none"}</strong>
                </p>
                <p>
                  Redistribute: <strong>{money(capResult.redistribute)}</strong>{" "}
                  → {capResult.nextBestCampaignId || "no eligible campaign"}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget action staging</CardTitle>
          <CardDescription>
            Meta accepts campaign/ad-set IDs; Google Ads accepts campaign-budget
            IDs or full resource names. TikTok remains recommendation-only until
            an owned Ads API connector is approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field>
              <FieldLabel>Platform</FieldLabel>
              <select
                value={actionPlatform}
                onChange={(event) =>
                  setActionPlatform(event.target.value as Platform)
                }
                className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
              >
                <option value="meta">Meta</option>
                <option value="google_ads">Google Ads</option>
                <option value="tiktok">TikTok</option>
              </select>
            </Field>
            {actionPlatform === "google_ads" ? (
              <Field>
                <FieldLabel>Campaign ID for learning checks</FieldLabel>
                <Input
                  value={actionCampaignId}
                  onChange={(event) =>
                    setActionCampaignId(event.target.value)
                  }
                  placeholder="campaigns/123456"
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel>
                {actionPlatform === "google_ads"
                  ? "Campaign budget ID"
                  : "Target ID"}
              </FieldLabel>
              <Input
                value={actionTarget}
                onChange={(event) => setActionTarget(event.target.value)}
                placeholder={
                  actionPlatform === "google_ads"
                    ? "campaignBudgets/123456"
                    : undefined
                }
              />
            </Field>
            <Field>
              <FieldLabel>Current daily budget</FieldLabel>
              <Input
                type="number"
                min="0"
                value={actionCurrentBudget}
                onChange={(event) =>
                  setActionCurrentBudget(Number(event.target.value))
                }
              />
            </Field>
            <Field>
              <FieldLabel>Recommended daily budget</FieldLabel>
              <Input
                type="number"
                min="0"
                value={actionBudget}
                onChange={(event) =>
                  setActionBudget(Number(event.target.value))
                }
              />
            </Field>
            <Field>
              <FieldLabel>Learning status</FieldLabel>
              <select
                value={learningStatus}
                onChange={(event) => setLearningStatus(event.target.value)}
                className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
              >
                <option value="NOT_LEARNING">Not learning</option>
                <option value="LEARNING">Learning</option>
                <option value="LEARNING_LIMITED">Learning limited</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void stageBudget(false)}
            >
              Stage dry run
            </Button>
            <Button
              type="button"
              disabled={
                !directBudgetWriteSupported ||
                !actionTarget ||
                actionCurrentBudget <= 0 ||
                actionBudget <= 0
              }
              onClick={() => void stageBudget(true)}
            >
              Apply budget
            </Button>
          </div>
          {actionMessage ? (
            <p className="text-sm text-muted-foreground">{actionMessage}</p>
          ) : null}
        </CardContent>
      </Card>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
