"use client";

import * as React from "react";
import { FlaskConicalIcon, HistoryIcon, SplitIcon } from "lucide-react";
import {
  experimentMetricFamily,
  type ExperimentDefinition,
  type ExperimentLogEntry,
  type ExperimentPlan,
  type ExperimentResultDashboard,
} from "@/lib/experiment-engine";
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

type ExperimentSegmentInput = {
  segment: string;
  controlSuccesses: number;
  controlSamples: number;
  treatmentSuccesses: number;
  treatmentSamples: number;
};

type ContinuousExperimentSegmentInput = {
  segment: string;
  controlMean: number;
  controlStandardDeviation: number;
  controlSamples: number;
  treatmentMean: number;
  treatmentStandardDeviation: number;
  treatmentSamples: number;
};

export function ExperimentWorkspace({ language }: { language: "en" | "vi" }) {
  const isVietnamese = language === "vi";
  const [experimentId, setExperimentId] = React.useState(
    "creative-ugc-vs-studio",
  );
  const [hypothesis, setHypothesis] = React.useState(
    "UGC creative improves conversion rate versus studio creative",
  );
  const [baselineRate, setBaselineRate] = React.useState(0.04);
  const [baselineStandardDeviation, setBaselineStandardDeviation] =
    React.useState(0.02);
  const [mde, setMde] = React.useState(0.2);
  const [dailyUsers, setDailyUsers] = React.useState(5000);
  const [metric, setMetric] =
    React.useState<ExperimentDefinition["metric"]>("conversion_rate");
  const [confidence, setConfidence] = React.useState(0.95);
  const [power, setPower] = React.useState(0.8);
  const [trafficAllocation, setTrafficAllocation] = React.useState(0.5);
  const [guardrails, setGuardrails] = React.useState("CPA, spend, quality");
  const [layer, setLayer] = React.useState("creative");
  const [assignmentUnit, setAssignmentUnit] = React.useState<"user" | "geo">(
    "user",
  );
  const [assignmentUnitId, setAssignmentUnitId] = React.useState("");
  const [controlSuccesses, setControlSuccesses] = React.useState(0);
  const [controlSamples, setControlSamples] = React.useState(0);
  const [treatmentSuccesses, setTreatmentSuccesses] = React.useState(0);
  const [treatmentSamples, setTreatmentSamples] = React.useState(0);
  const [controlMean, setControlMean] = React.useState(50);
  const [controlStandardDeviation, setControlStandardDeviation] =
    React.useState(20);
  const [treatmentMean, setTreatmentMean] = React.useState(45);
  const [treatmentStandardDeviation, setTreatmentStandardDeviation] =
    React.useState(20);
  const [segmentsJson, setSegmentsJson] = React.useState("[]");
  const [plan, setPlan] = React.useState<ExperimentPlan | null>(null);
  const [result, setResult] = React.useState<ExperimentResultDashboard | null>(
    null,
  );
  const [sequential, setSequential] = React.useState<{
    status: string;
    recommendation: string;
    likelihoodRatio: number;
  } | null>(null);
  const [assignment, setAssignment] = React.useState<{
    variant: string;
    unitId: string;
  } | null>(null);
  const [entries, setEntries] = React.useState<ExperimentLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [error, setError] = React.useState("");

  const metricFamily = experimentMetricFamily(metric);
  const definition = React.useMemo<ExperimentDefinition>(
    () => ({
      id: experimentId.trim(),
      hypothesis,
      metric,
      baselineRate,
      ...(metricFamily === "continuous" ? { baselineStandardDeviation } : {}),
      minimumDetectableEffect: mde,
      confidence,
      power,
      trafficAllocation,
      assignmentUnit,
      guardrails: guardrails
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      layer,
    }),
    [
      assignmentUnit,
      baselineRate,
      baselineStandardDeviation,
      confidence,
      experimentId,
      guardrails,
      hypothesis,
      layer,
      mde,
      metric,
      metricFamily,
      power,
      trafficAllocation,
    ],
  );
  const loadLog = React.useCallback(
    (query = "") =>
      jsonFetch<{ entries: ExperimentLogEntry[] }>(
        `/api/experiments/log?q=${encodeURIComponent(query)}`,
        { timeoutMs: 5000 },
      ).then((data) => setEntries(data.entries)),
    [],
  );
  React.useEffect(() => {
    void loadLog().catch(() => undefined);
  }, [loadLog]);

  async function buildPlan() {
    setError("");
    try {
      const data = await jsonFetch<{ plan: ExperimentPlan }>(
        "/api/experiments/plan",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            definition,
            observedDailyEligibleUsers: dailyUsers,
          }),
          timeoutMs: 8000,
        },
      );
      setPlan(data.plan);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create plan.",
      );
    }
  }

  async function evaluate() {
    setError("");
    try {
      const parsedSegments = JSON.parse(segmentsJson) as unknown;
      if (!Array.isArray(parsedSegments))
        throw new Error("Segment breakdown must be a JSON array.");
      let payload: Record<string, unknown>;
      if (metricFamily === "binary") {
        const segments = parsedSegments as ExperimentSegmentInput[];
        if (
          segments.some(
            (segment) =>
              !segment.segment ||
              segment.controlSuccesses > segment.controlSamples ||
              segment.treatmentSuccesses > segment.treatmentSamples,
          )
        )
          throw new Error(
            "Each segment needs a name and valid success/sample counts.",
          );
        if (
          controlSuccesses > controlSamples ||
          treatmentSuccesses > treatmentSamples
        )
          throw new Error("Successes cannot exceed samples.");
        payload = {
          metric,
          controlSuccesses,
          controlSamples,
          treatmentSuccesses,
          treatmentSamples,
          relativeMde: mde,
          segments,
        };
      } else {
        const segments = parsedSegments as ContinuousExperimentSegmentInput[];
        if (
          segments.some(
            (segment) =>
              !segment.segment ||
              segment.controlStandardDeviation <= 0 ||
              segment.treatmentStandardDeviation <= 0 ||
              segment.controlSamples <= 0 ||
              segment.treatmentSamples <= 0,
          )
        )
          throw new Error(
            "Each segment needs a name, means, positive standard deviations, and sample counts.",
          );
        payload = {
          metric,
          controlMean,
          controlStandardDeviation,
          controlSamples,
          treatmentMean,
          treatmentStandardDeviation,
          treatmentSamples,
          relativeMde: mde,
          segments,
        };
      }
      const data = await jsonFetch<{
        dashboard: ExperimentResultDashboard;
        sequential: {
          status: string;
          recommendation: string;
          likelihoodRatio: number;
        };
      }>("/api/experiments/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: 8000,
      });
      setResult(data.dashboard);
      setSequential(data.sequential);
      await jsonFetch("/api/experiments/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ definition, result: data.dashboard }),
        timeoutMs: 8000,
      });
      await loadLog(searchQuery);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not evaluate results.",
      );
    }
  }

  async function assignSample() {
    setError("");
    if (!assignmentUnitId.trim()) {
      setError("Enter a user, device, or geo assignment ID first.");
      return;
    }
    try {
      const unitId = assignmentUnitId.trim();
      const data = await jsonFetch<{ assignment: { variant: string } }>(
        "/api/experiments/assign",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            experimentId: definition.id,
            layer: definition.layer,
            unitId,
            treatmentAllocation: definition.trafficAllocation,
            trafficAllocation: 1,
          }),
          timeoutMs: 8000,
        },
      );
      setAssignment({ variant: data.assignment.variant, unitId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Assignment failed.");
    }
  }

  async function endExperiment() {
    setError("");
    if (!definition.id) {
      setError("Enter an experiment ID first.");
      return;
    }
    try {
      await jsonFetch<{ release: { released: number } }>(
        "/api/experiments/assign",
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ experimentId: definition.id }),
          timeoutMs: 8000,
        },
      );
      setAssignment(null);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not end experiment.",
      );
    }
  }

  function selectMetric(nextMetric: ExperimentDefinition["metric"]) {
    const nextFamily = experimentMetricFamily(nextMetric);
    setMetric(nextMetric);
    setPlan(null);
    setResult(null);
    setSequential(null);
    setSegmentsJson("[]");
    if (nextFamily === "binary" && (baselineRate <= 0 || baselineRate >= 1)) {
      setBaselineRate(0.04);
      setBaselineStandardDeviation(0.02);
    } else if (
      nextFamily === "continuous" &&
      baselineRate > 0 &&
      baselineRate < 1
    ) {
      const nextBaseline = nextMetric === "roas" ? 2 : 50;
      setBaselineRate(nextBaseline);
      setBaselineStandardDeviation(nextMetric === "roas" ? 0.8 : 20);
      setControlMean(nextBaseline);
      setTreatmentMean(nextMetric === "roas" ? 2.2 : 45);
      setControlStandardDeviation(nextMetric === "roas" ? 0.8 : 20);
      setTreatmentStandardDeviation(nextMetric === "roas" ? 0.8 : 20);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)]">
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl border bg-background">
              <FlaskConicalIcon className="size-4" />
            </span>
            <div>
              <CardTitle>
                {isVietnamese ? "Test designer" : "Test designer"}
              </CardTitle>
              <CardDescription>
                Hypothesis, MDE, power, allocation, guardrails, and assignment
                layer.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Experiment ID</FieldLabel>
              <Input
                value={experimentId}
                onChange={(event) => setExperimentId(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Hypothesis</FieldLabel>
              <Input
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Primary metric</FieldLabel>
              <select
                value={metric}
                onChange={(event) =>
                  selectMetric(
                    event.target.value as ExperimentDefinition["metric"],
                  )
                }
                className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
              >
                <option value="conversion_rate">Conversion rate</option>
                <option value="cpa">CPA</option>
                <option value="roas">ROAS</option>
                <option value="ctr">CTR</option>
                <option value="cost_per_lead">Cost per lead</option>
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel>
                  Baseline {metricFamily === "binary" ? "rate" : "value"}
                </FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={baselineRate}
                  onChange={(event) =>
                    setBaselineRate(Number(event.target.value))
                  }
                />
              </Field>
              {metricFamily === "continuous" ? (
                <Field>
                  <FieldLabel>Baseline standard deviation</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={baselineStandardDeviation}
                    onChange={(event) =>
                      setBaselineStandardDeviation(Number(event.target.value))
                    }
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel>MDE</FieldLabel>
                <Input
                  type="number"
                  step="0.05"
                  value={mde}
                  onChange={(event) => setMde(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel>Daily users</FieldLabel>
                <Input
                  type="number"
                  value={dailyUsers}
                  onChange={(event) =>
                    setDailyUsers(Number(event.target.value))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel>Confidence</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={confidence}
                  onChange={(event) =>
                    setConfidence(Number(event.target.value))
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Power</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={power}
                  onChange={(event) => setPower(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel>Treatment share</FieldLabel>
                <Input
                  type="number"
                  step="0.05"
                  value={trafficAllocation}
                  onChange={(event) =>
                    setTrafficAllocation(Number(event.target.value))
                  }
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Guardrails</FieldLabel>
              <Input
                value={guardrails}
                onChange={(event) => setGuardrails(event.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Assignment unit</FieldLabel>
                <select
                  value={assignmentUnit}
                  onChange={(event) =>
                    setAssignmentUnit(event.target.value as "user" | "geo")
                  }
                  className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
                >
                  <option value="user">User / cookie</option>
                  <option value="geo">Geo</option>
                </select>
              </Field>
              <Field>
                <FieldLabel>Exclusive layer</FieldLabel>
                <Input
                  value={layer}
                  onChange={(event) => setLayer(event.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Assignment ID</FieldLabel>
              <Input
                value={assignmentUnitId}
                onChange={(event) => setAssignmentUnitId(event.target.value)}
                placeholder="cookie, IDFA, or geo ID"
              />
            </Field>
            {metricFamily === "binary" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Control successes</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={controlSuccesses}
                    onChange={(event) =>
                      setControlSuccesses(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Control samples</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={controlSamples}
                    onChange={(event) =>
                      setControlSamples(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Treatment successes</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={treatmentSuccesses}
                    onChange={(event) =>
                      setTreatmentSuccesses(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Treatment samples</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={treatmentSamples}
                    onChange={(event) =>
                      setTreatmentSamples(Number(event.target.value))
                    }
                  />
                </Field>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Control mean</FieldLabel>
                  <Input
                    type="number"
                    value={controlMean}
                    onChange={(event) =>
                      setControlMean(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Control standard deviation</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={controlStandardDeviation}
                    onChange={(event) =>
                      setControlStandardDeviation(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Control samples</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={controlSamples}
                    onChange={(event) =>
                      setControlSamples(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Treatment mean</FieldLabel>
                  <Input
                    type="number"
                    value={treatmentMean}
                    onChange={(event) =>
                      setTreatmentMean(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Treatment standard deviation</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={treatmentStandardDeviation}
                    onChange={(event) =>
                      setTreatmentStandardDeviation(Number(event.target.value))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Treatment samples</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    value={treatmentSamples}
                    onChange={(event) =>
                      setTreatmentSamples(Number(event.target.value))
                    }
                  />
                </Field>
              </div>
            )}
            <Field>
              <FieldLabel>Segment breakdown JSON</FieldLabel>
              <textarea
                value={segmentsJson}
                onChange={(event) => setSegmentsJson(event.target.value)}
                rows={3}
                className="rounded-lg border bg-background p-2 font-mono text-xs text-foreground"
                placeholder={
                  metricFamily === "binary"
                    ? '[{"segment":"mobile","controlSuccesses":0,"controlSamples":100,"treatmentSuccesses":0,"treatmentSamples":100}]'
                    : '[{"segment":"mobile","controlMean":50,"controlStandardDeviation":20,"controlSamples":100,"treatmentMean":45,"treatmentStandardDeviation":20,"treatmentSamples":100}]'
                }
              />
            </Field>
          </FieldGroup>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void buildPlan()}>
              <SplitIcon data-icon="inline-start" />
              Calculate sample size
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void assignSample()}
            >
              Assign sample
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void endExperiment()}
            >
              End experiment
            </Button>
          </div>
          {assignment ? (
            <p className="text-xs text-muted-foreground">
              {assignment.unitId} → <strong>{assignment.variant}</strong>
            </p>
          ) : null}
          {plan ? (
            <div className="rounded-xl border p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge
                  variant={plan.status === "ready" ? "success" : "outline"}
                >
                  {plan.status}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Required samples
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {plan.totalRequiredSamples.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Estimated days
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {plan.estimatedDays || "—"}
                  </p>
                </div>
              </div>
              {plan.blockers.length ? (
                <p className="mt-3 text-xs text-destructive">
                  {plan.blockers.join(" ")}
                </p>
              ) : null}
              <Button
                className="mt-4 w-full"
                variant="outline"
                disabled={
                  plan.status !== "ready" ||
                  controlSamples < 1 ||
                  treatmentSamples < 1 ||
                  (metricFamily === "continuous" &&
                    (controlStandardDeviation <= 0 ||
                      treatmentStandardDeviation <= 0))
                }
                onClick={() => void evaluate()}
              >
                Evaluate sample result
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Sequential results</CardTitle>
            <CardDescription>
              Lift, confidence interval, p-value, mSPRT boundary, and
              ship/kill/iterate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Lift", `${(result.lift * 100).toFixed(1)}%`],
                  [
                    "95% CI",
                    `${(result.confidenceInterval[0] * 100).toFixed(1)}–${(result.confidenceInterval[1] * 100).toFixed(1)}%`,
                  ],
                  ["p-value", result.pValue.toFixed(4)],
                  ["Decision", result.recommendation],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-base font-semibold">{value}</p>
                  </div>
                ))}
                {sequential ? (
                  <div className="rounded-xl border p-3 sm:col-span-2">
                    <p className="text-xs text-muted-foreground">mSPRT</p>
                    <p className="mt-1 text-sm font-semibold">
                      {sequential.status} · {sequential.recommendation}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Likelihood ratio {sequential.likelihoodRatio.toFixed(2)}
                    </p>
                  </div>
                ) : null}
                {result.segments.map((segment) => (
                  <div key={segment.segment} className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">
                      {segment.segment}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {(segment.lift * 100).toFixed(1)}% lift
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {segment.samples.toLocaleString()} samples
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Create a plan, then evaluate sample results.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <HistoryIcon className="size-4" />
                <CardTitle>Experiment knowledge base</CardTitle>
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="Search experiment learnings"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search learnings"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadLog(searchQuery)}
                >
                  Search
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length ? (
              <div className="divide-y rounded-xl border">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {entry.definition.hypothesis}
                      </p>
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {entry.learning || "Experiment planned; result pending."}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No saved experiments match this search.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
