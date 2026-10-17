"use client";

import * as React from "react";
import { FlaskConicalIcon, HistoryIcon, SplitIcon } from "lucide-react";
import {
  buildExperimentPlan,
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
import { parseFunnelPlannerDraft, type FunnelTestBrief } from "@/lib/funnel-investigation";

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

export function ExperimentWorkspace({ language, initialBrief, planningOnly = false }: { language: "en" | "vi"; initialBrief?: FunnelTestBrief; planningOnly?: boolean }) {
  const isVietnamese = language === "vi";
  const t = (en: string, vi: string) => isVietnamese ? vi : en;
  const fieldId = React.useId();
  const [measurementDefinition, setMeasurementDefinition] = React.useState("");
  const [planningStorageReady, setPlanningStorageReady] = React.useState(false);
  const [planningStorageError, setPlanningStorageError] = React.useState(false);
  const planningStorageKey = planningOnly && initialBrief ? `funnel-planner-v1:${initialBrief.id}` : null;
  const [experimentId, setExperimentId] = React.useState(
    initialBrief ? `funnel-${initialBrief.observation.stage}-${initialBrief.id.slice(0, 8)}` : "creative-ugc-vs-studio",
  );
  const [hypothesis, setHypothesis] = React.useState(
    initialBrief?.draft.hypothesis ?? "UGC creative improves conversion rate versus studio creative",
  );
  const [baselineRate, setBaselineRate] = React.useState(initialBrief ? 0 : 0.04);
  const [baselineStandardDeviation, setBaselineStandardDeviation] =
    React.useState(initialBrief ? 0 : 0.02);
  const [mde, setMde] = React.useState(0.2);
  const [dailyUsers, setDailyUsers] = React.useState(initialBrief ? 0 : 5000);
  const [metric, setMetric] =
    React.useState<ExperimentDefinition["metric"]>(initialBrief?.draft.metric ?? "conversion_rate");
  const [confidence, setConfidence] = React.useState(0.95);
  const [power, setPower] = React.useState(0.8);
  const [trafficAllocation, setTrafficAllocation] = React.useState(0.5);
  const [guardrails, setGuardrails] = React.useState(initialBrief?.draft.guardrails ?? "CPA, spend, quality");
  const [layer, setLayer] = React.useState(initialBrief ? `funnel-${initialBrief.observation.stage}` : "creative");
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
    if (!planningStorageKey || !initialBrief) return;
    try {
      const saved = parseFunnelPlannerDraft(window.sessionStorage.getItem(planningStorageKey), initialBrief.id);
      if (saved) {
        const value = saved.definition;
        setExperimentId(value.id); setHypothesis(value.hypothesis); setMetric(value.metric);
        setBaselineRate(value.baselineRate); setBaselineStandardDeviation(value.baselineStandardDeviation ?? 0);
        setMde(value.minimumDetectableEffect); setConfidence(value.confidence); setPower(value.power);
        setTrafficAllocation(value.trafficAllocation); setAssignmentUnit(value.assignmentUnit);
        setGuardrails(value.guardrails.join(", ")); setLayer(value.layer);
        setDailyUsers(saved.dailyUnits); setMeasurementDefinition(saved.measurementDefinition);
      }
    } catch { setPlanningStorageError(true); }
    setPlanningStorageReady(true);
  }, [planningStorageKey, initialBrief]);
  React.useEffect(() => {
    if (!planningStorageKey || !initialBrief || !planningStorageReady) return;
    try { window.sessionStorage.setItem(planningStorageKey, JSON.stringify({ version: 1, briefId: initialBrief.id, definition, dailyUnits: dailyUsers, measurementDefinition })); }
    catch { setPlanningStorageError(true); }
  }, [planningStorageKey, initialBrief, planningStorageReady, definition, dailyUsers, measurementDefinition]);
  React.useEffect(() => {
    if (!planningOnly) void loadLog().catch(() => undefined);
  }, [loadLog, planningOnly]);
  React.useEffect(() => { setPlan(null); }, [definition, dailyUsers, measurementDefinition]);

  async function buildPlan() {
    setError("");
    if (planningOnly) {
      setPlan(null);
      if (!measurementDefinition.trim() || !hypothesis.trim() || !experimentId.trim() || !Number.isFinite(dailyUsers) || dailyUsers <= 0) {
        setError(t("Define the measurement source, eligible population and positive daily volume before calculating.", "Nhập nguồn đo, nhóm đủ điều kiện và số lượng mỗi ngày lớn hơn 0 trước khi tính."));
        return;
      }
      if (!Number.isFinite(baselineRate) || baselineRate <= 0 || metricFamily === "binary" && baselineRate >= 1) {
        setError(metricFamily === "binary"
          ? t("Enter a measured baseline percentage greater than 0 and less than 100 (for example, 4 for 4%).", "Nhập tỷ lệ nền đã đo lớn hơn 0% và nhỏ hơn 100% (ví dụ nhập 4 cho 4%).")
          : t("Enter a positive measured baseline mean for the selected outcome.", "Nhập giá trị trung bình đã đo lớn hơn 0 cho kết quả đã chọn."));
        return;
      }
      if (metricFamily === "continuous" && (!Number.isFinite(baselineStandardDeviation) || baselineStandardDeviation <= 0)) {
        setError(t("Enter the measured baseline standard deviation, greater than 0.", "Nhập độ lệch chuẩn của mốc đã đo, lớn hơn 0."));
        return;
      }
      if (![mde, confidence, power, trafficAllocation].every(Number.isFinite) || mde <= 0 || confidence <= 0.5 || confidence >= 1 || power <= 0.5 || power >= 1 || trafficAllocation <= 0 || trafficAllocation >= 1) {
        setError(t("Use an improvement greater than 0%, confidence and power above 50% and below 100%, and a test group share above 0% and below 100%.", "Nhập mức cải thiện lớn hơn 0%; độ tin cậy và lực kiểm định trên 50%, dưới 100%; tỷ lệ nhóm thử nghiệm trên 0%, dưới 100%."));
        return;
      }
      setPlan(buildExperimentPlan(definition, dailyUsers));
      return;
    }
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
    if (planningOnly) {
      setBaselineRate(0);
      setBaselineStandardDeviation(0);
      return;
    }
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
    <div className={planningOnly ? "grid gap-4" : "grid gap-4 xl:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)]"}>
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl border bg-background">
              <FlaskConicalIcon className="size-4" />
            </span>
            <div>
              <CardTitle>
                {planningOnly ? t("Test size and timing", "Quy mô và thời gian thử nghiệm") : t("Test designer", "Thiết kế thử nghiệm")}
              </CardTitle>
              <CardDescription>
                {planningOnly ? t("Use measured inputs from the people or observations you plan to test.", "Dùng dữ liệu đã đo từ nhóm người hoặc quan sát dự kiến thử nghiệm.") : t("Define the outcome, measurement and allocation before planning.", "Xác định kết quả, phép đo và cách phân bổ trước khi lập kế hoạch.")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FieldGroup>
            {planningOnly ? (
            <>
              <p className="text-xs text-muted-foreground" role={planningStorageError ? "alert" : undefined}>{planningStorageError ? t("Saving is unavailable. Keep this dialog open to retain your inputs.", "Chưa lưu được. Giữ hộp thoại mở để giữ dữ liệu đã nhập.") : t("Your inputs stay in this tab. The saved hypothesis and evidence stay unchanged.", "Dữ liệu đã nhập được giữ trong tab này. Giả thuyết và dữ liệu đã lưu vẫn giữ nguyên.")}</p>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-measurement`}>{t("Where will you measure the test?", "Bạn sẽ đo thử nghiệm ở đâu?")}</FieldLabel>
                <Input id={`${fieldId}-measurement`} aria-describedby={`${fieldId}-measurement-help`} value={measurementDefinition} onChange={event => setMeasurementDefinition(event.target.value)} placeholder={t("For example: CRM outcomes for randomly assigned eligible users", "Ví dụ: kết quả CRM của người dùng đủ điều kiện được phân nhóm ngẫu nhiên")} />
                <p id={`${fieldId}-measurement-help`} className="text-xs text-muted-foreground">{t("Name the data source, who can enter the test and what one observation means. The Funnel's event counts are not an experimental baseline.", "Nêu nguồn dữ liệu, nhóm có thể tham gia và một quan sát là gì. Số sự kiện trong Phễu chưa phải dữ liệu nền của thử nghiệm.")}</p>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-metric`}>{t("Main success metric", "Chỉ số đánh giá thành công")}</FieldLabel>
                <select id={`${fieldId}-metric`} value={metric} onChange={event => selectMetric(event.target.value as ExperimentDefinition["metric"])} className="h-10 rounded-lg border bg-background px-2 text-sm text-foreground">
                  <option value="conversion_rate">{t("User conversion rate", "Tỷ lệ chuyển đổi người dùng")}</option><option value="cpa">{t("Cost per result (CPA)", "Chi phí mỗi kết quả (CPA)")}</option><option value="roas">{t("Return on ad spend (ROAS)", "Doanh thu trên chi tiêu quảng cáo (ROAS)")}</option><option value="ctr">{t("Click-through rate (CTR)", "Tỷ lệ nhấp (CTR)")}</option><option value="cost_per_lead">{t("Cost per lead", "Chi phí mỗi lead")}</option>
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-baseline`}>{metricFamily === "binary" ? t("Measured baseline rate (%)", "Tỷ lệ nền đã đo (%)") : t("Measured baseline average", "Giá trị trung bình nền đã đo")}</FieldLabel>
                  <Input id={`${fieldId}-baseline`} type="number" min="0" step="0.01" aria-describedby={`${fieldId}-baseline-help`} value={baselineRate > 0 ? metricFamily === "binary" ? Number((baselineRate * 100).toFixed(6)) : baselineRate : ""} onChange={event => setBaselineRate(Number(event.target.value) / (metricFamily === "binary" ? 100 : 1))} placeholder={metricFamily === "binary" ? "4" : "50"} />
                  <p id={`${fieldId}-baseline-help`} className="text-xs text-muted-foreground">{metricFamily === "binary" ? t("Enter 4 for 4%. Use independent eligible users with one yes/no outcome per user.", "Nhập 4 cho 4%. Dùng người dùng đủ điều kiện độc lập, mỗi người có một kết quả có/không.") : t("Use the measured average per observation in the same units as your chosen metric.", "Dùng trung bình đã đo trên mỗi quan sát, cùng đơn vị với chỉ số đã chọn.")}</p>
                </Field>
                {metricFamily === "continuous" ? <Field>
                  <FieldLabel htmlFor={`${fieldId}-deviation`}>{t("Baseline standard deviation", "Độ lệch chuẩn của dữ liệu nền")}</FieldLabel>
                  <Input id={`${fieldId}-deviation`} type="number" min="0" step="0.01" aria-describedby={`${fieldId}-deviation-help`} value={baselineStandardDeviation > 0 ? baselineStandardDeviation : ""} onChange={event => setBaselineStandardDeviation(Number(event.target.value))} placeholder="20" />
                  <p id={`${fieldId}-deviation-help`} className="text-xs text-muted-foreground">{t("How much observations vary around that average. Calculate it from the same data; do not guess.", "Mức dao động của các quan sát quanh trung bình. Tính từ cùng dữ liệu, không ước đoán.")}</p>
                </Field> : null}
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-mde`}>{t("Improvement worth detecting (%)", "Mức cải thiện cần phát hiện (%)")}</FieldLabel>
                  <Input id={`${fieldId}-mde`} type="number" min="0" step="1" aria-describedby={`${fieldId}-mde-help`} value={Number((mde * 100).toFixed(6))} onChange={event => setMde(Number(event.target.value) / 100)} />
                  <p id={`${fieldId}-mde-help`} className="text-xs text-muted-foreground">{metricFamily === "binary" ? t("Relative improvement: 20% takes a 4% rate to 4.8%, not 24%.", "Cải thiện tương đối: tăng 20% đưa tỷ lệ 4% lên 4,8%, không phải 24%.") : metric === "roas" ? t("A 20% improvement takes an average of 2 to 2.4.", "Cải thiện 20% đưa trung bình từ 2 lên 2,4.") : t("A 20% improvement lowers an average cost of 50 to 40.", "Cải thiện 20% giảm chi phí trung bình từ 50 xuống 40.")}</p>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-daily`}>{t("Eligible observations per day", "Số quan sát đủ điều kiện mỗi ngày")}</FieldLabel>
                  <Input id={`${fieldId}-daily`} type="number" min="0" aria-describedby={`${fieldId}-daily-help`} value={dailyUsers > 0 ? dailyUsers : ""} onChange={event => setDailyUsers(Number(event.target.value))} placeholder="100" />
                  <p id={`${fieldId}-daily-help`} className="text-xs text-muted-foreground">{t("Combined daily volume across both groups. Match the baseline's measurement unit.", "Tổng số mỗi ngày của cả hai nhóm. Dùng cùng đơn vị quan sát với dữ liệu nền.")}</p>
                </Field>
              </div>
              <details className="funnel-planner-advanced"><summary>{t("Advanced settings", "Thiết lập nâng cao")}<span className="text-muted-foreground">{t("Confidence, power and allocation", "Độ tin cậy, lực kiểm định và phân bổ")}</span></summary><div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field><FieldLabel htmlFor={`${fieldId}-confidence`}>{t("Confidence level (%)", "Mức tin cậy (%)")}</FieldLabel><Input id={`${fieldId}-confidence`} type="number" min="50.01" max="99.99" step="1" value={Number((confidence * 100).toFixed(6))} onChange={event => setConfidence(Number(event.target.value) / 100)} /><p className="text-xs text-muted-foreground">{t("Higher confidence usually needs more observations.", "Mức tin cậy cao hơn thường cần nhiều quan sát hơn.")}</p></Field>
                  <Field><FieldLabel htmlFor={`${fieldId}-power`}>{t("Statistical power (%)", "Lực kiểm định (%)")}</FieldLabel><Input id={`${fieldId}-power`} type="number" min="50.01" max="99.99" step="1" value={Number((power * 100).toFixed(6))} onChange={event => setPower(Number(event.target.value) / 100)} /><p className="text-xs text-muted-foreground">{t("Chance of detecting the improvement if it exists.", "Khả năng phát hiện mức cải thiện nếu nó thực sự tồn tại.")}</p></Field>
                  <Field><FieldLabel htmlFor={`${fieldId}-allocation`}>{t("Test group share (%)", "Tỷ lệ nhóm thử nghiệm (%)")}</FieldLabel><Input id={`${fieldId}-allocation`} type="number" min="0.01" max="99.99" step="1" value={Number((trafficAllocation * 100).toFixed(6))} onChange={event => setTrafficAllocation(Number(event.target.value) / 100)} /><p className="text-xs text-muted-foreground">{t("The rest goes to the current version (control).", "Phần còn lại vào phiên bản hiện tại (đối chứng).")}</p></Field>
                </div>
                <Field><FieldLabel htmlFor={`${fieldId}-hypothesis`}>{t("Working hypothesis", "Giả thuyết cho kế hoạch")}</FieldLabel><Input id={`${fieldId}-hypothesis`} value={hypothesis} onChange={event => setHypothesis(event.target.value)} /><p className="text-xs text-muted-foreground">{t("Changes here affect this plan only. The saved hypothesis stays fixed.", "Thay đổi ở đây chỉ áp dụng cho kế hoạch. Giả thuyết đã lưu được giữ nguyên.")}</p></Field>
                <Field><FieldLabel htmlFor={`${fieldId}-guardrails`}>{t("Metrics that must not get worse", "Các chỉ số không được xấu đi")}</FieldLabel><Input id={`${fieldId}-guardrails`} value={guardrails} onChange={event => setGuardrails(event.target.value)} /></Field>
                <Field><FieldLabel htmlFor={`${fieldId}-id`}>{t("Experiment identifier", "Mã định danh thử nghiệm")}</FieldLabel><Input id={`${fieldId}-id`} value={experimentId} onChange={event => setExperimentId(event.target.value)} /></Field>
                <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor={`${fieldId}-unit`}>{t("Random assignment unit", "Đơn vị phân nhóm ngẫu nhiên")}</FieldLabel><select id={`${fieldId}-unit`} value={assignmentUnit} onChange={event => setAssignmentUnit(event.target.value as "user" | "geo")} className="h-10 rounded-lg border bg-background px-2 text-sm text-foreground"><option value="user">{t("User / cookie", "Người dùng / cookie")}</option><option value="geo">{t("Geographic area", "Khu vực địa lý")}</option></select></Field><Field><FieldLabel htmlFor={`${fieldId}-layer`}>{t("Experiment layer", "Lớp thử nghiệm")}</FieldLabel><Input id={`${fieldId}-layer`} value={layer} onChange={event => setLayer(event.target.value)} /></Field></div>
                <p className="text-xs text-muted-foreground">{t("This estimate assumes independent observations. Geographic clusters and repeated-user events need a measurement design that accounts for dependence.", "Ước tính giả định các quan sát độc lập. Nhóm địa lý và sự kiện lặp của một người cần thiết kế phép đo có tính đến sự phụ thuộc.")}</p>
              </div></details>
            </>
            ) : (<>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-id`}>{t("Experiment ID", "Mã thử nghiệm")}</FieldLabel>
              <Input
                id={`${fieldId}-id`}
                value={experimentId}
                onChange={(event) => setExperimentId(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-hypothesis`}>{t("Hypothesis", "Giả thuyết")}</FieldLabel>
              <Input
                id={`${fieldId}-hypothesis`}
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-metric`}>{t("Primary metric", "Chỉ số chính")}</FieldLabel>
              <select
                id={`${fieldId}-metric`}
                value={metric}
                onChange={(event) =>
                  selectMetric(
                    event.target.value as ExperimentDefinition["metric"],
                  )
                }
                className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
              >
                <option value="conversion_rate">{t("Conversion rate", "Tỷ lệ chuyển đổi")}</option>
                <option value="cpa">CPA</option>
                <option value="roas">ROAS</option>
                <option value="ctr">CTR</option>
                <option value="cost_per_lead">{t("Cost per lead", "Chi phí mỗi lead")}</option>
              </select>
            </Field>
            <div className={planningOnly ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-baseline`}>
                  {metricFamily === "binary" ? t("Baseline rate (0–1)", "Tỷ lệ nền (0–1)") : t("Baseline value", "Giá trị nền")}
                </FieldLabel>
                <Input
                  id={`${fieldId}-baseline`}
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
                  <FieldLabel htmlFor={`${fieldId}-deviation`}>{t("Baseline standard deviation", "Độ lệch chuẩn nền")}</FieldLabel>
                  <Input
                    id={`${fieldId}-deviation`}
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
                <FieldLabel htmlFor={`${fieldId}-mde`}>{t("Minimum relative effect", "Mức tác động tương đối tối thiểu")}</FieldLabel>
                <Input
                  id={`${fieldId}-mde`}
                  type="number"
                  step="0.05"
                  value={mde}
                  onChange={(event) => setMde(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-daily`}>{t("Eligible units / day", "Đơn vị đủ điều kiện / ngày")}</FieldLabel>
                <Input
                  id={`${fieldId}-daily`}
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
                <FieldLabel htmlFor={`${fieldId}-confidence`}>{t("Confidence", "Mức tin cậy")}</FieldLabel>
                <Input
                  id={`${fieldId}-confidence`}
                  type="number"
                  step="0.01"
                  value={confidence}
                  onChange={(event) =>
                    setConfidence(Number(event.target.value))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-power`}>{t("Power", "Lực kiểm định")}</FieldLabel>
                <Input
                  id={`${fieldId}-power`}
                  type="number"
                  step="0.01"
                  value={power}
                  onChange={(event) => setPower(Number(event.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-allocation`}>{t("Treatment share", "Tỷ trọng nhóm thử nghiệm")}</FieldLabel>
                <Input
                  id={`${fieldId}-allocation`}
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
              <FieldLabel htmlFor={`${fieldId}-guardrails`}>{t("Guardrails", "Chỉ số bảo vệ")}</FieldLabel>
              <Input
                id={`${fieldId}-guardrails`}
                value={guardrails}
                onChange={(event) => setGuardrails(event.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${fieldId}-unit`}>{t("Assignment unit", "Đơn vị phân nhóm")}</FieldLabel>
                <select
                  id={`${fieldId}-unit`}
                  value={assignmentUnit}
                  onChange={(event) =>
                    setAssignmentUnit(event.target.value as "user" | "geo")
                  }
                  className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"
                >
                  <option value="user">{t("User / cookie", "Người dùng / cookie")}</option>
                  <option value="geo">{t("Geo", "Địa lý")}</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-layer`}>{t("Exclusive layer", "Lớp phân bổ riêng")}</FieldLabel>
                <Input
                  id={`${fieldId}-layer`}
                  value={layer}
                  onChange={(event) => setLayer(event.target.value)}
                />
              </Field>
            </div>
            {!planningOnly ? <><Field>
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
            </Field></> : null}
            </>)}
          </FieldGroup>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void buildPlan()}>
              <SplitIcon data-icon="inline-start" />
              {planningOnly ? t("Estimate test size", "Ước tính quy mô thử nghiệm") : t("Calculate sample size", "Tính cỡ mẫu")}
            </Button>
            {!planningOnly ? <><Button
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
            </Button></> : null}
          </div>
          {assignment ? (
            <p className="text-xs text-muted-foreground">
              {assignment.unitId} → <strong>{assignment.variant}</strong>
            </p>
          ) : null}
          {plan ? (
            <div className="rounded-xl border p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>{t("Planning status", "Trạng thái kế hoạch")}</span>
                <Badge
                  variant={plan.status === "ready" ? "success" : "outline"}
                >
                  {plan.status === "ready" ? t("Estimate ready", "Đã có ước tính") : t("Needs input", "Cần bổ sung")}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("Observations needed", "Số quan sát cần có")}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {plan.status === "ready" && Number.isFinite(plan.totalRequiredSamples) ? plan.totalRequiredSamples.toLocaleString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("Estimated days", "Số ngày ước tính")}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {plan.status === "ready" && Number.isFinite(plan.estimatedDays) ? plan.estimatedDays : "—"}
                  </p>
                </div>
              </div>
              {plan.blockers.length ? (
                <p className="mt-3 text-xs text-destructive">
                  {plan.blockers.join(" ")}
                </p>
              ) : null}
              {!planningOnly ? <Button
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
              </Button> : <p className="mt-3 text-xs text-muted-foreground">{t("Planning estimate only. A valid randomization and measurement setup is still required before running a test.", "Chỉ là ước tính kế hoạch. Cần thiết lập phân ngẫu nhiên và phép đo phù hợp trước khi chạy thử nghiệm.")}</p>}
            </div>
          ) : null}
        </CardContent>
      </Card>
      {!planningOnly ? <div className="grid gap-4">
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
      </div> : null}
    </div>
  );
}
