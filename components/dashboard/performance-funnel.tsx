"use client";

import * as React from "react";
import { ArrowRightIcon, ArrowDownRightIcon, ArrowUpRightIcon, ChevronDownIcon, InfoIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { defaultFunnelTarget, describeFunnelFocus, funnelMetricLabel, funnelRateDelta, hasLowFunnelVolume, measureFunnelStage, modelStageTarget, primaryFunnelStage, funnelBreakdownRows, funnelRowKey, funnelRowLabel, indexFunnelRows, funnelValueChange, type FunnelBreakdown } from "@/lib/funnel-analysis";
import { buildFunnelObservation, defaultFunnelBriefMetric, funnelObservationKey, type FunnelBriefDraft } from "@/lib/funnel-investigation";
import { FunnelTestBriefPanel } from "@/components/dashboard/funnel-test-brief";
import { formatMetric } from "@/lib/metrics";
import { comparisonDescriptor } from "@/lib/metric-comparison";
import type { PerformanceStage, PerformanceStageKey } from "@/lib/performance-stages";
import type { CompareMode, DashboardReport, InterfaceLanguage, NormalizedRow } from "@/lib/types";

type Props = {
  report: DashboardReport;
  previousReport: DashboardReport | null;
  compareMode: CompareMode;
  stages: PerformanceStage[];
  language: InterfaceLanguage;
  compact?: boolean;
  businessTargets?: { cpa?: string; roas?: string };
  viewState?: FunnelViewState;
  onViewStateChange?: React.Dispatch<React.SetStateAction<FunnelViewState>>;
  onOpenFunnel?: (key?: PerformanceStageKey) => void;
  onEditScope?: () => void;
  onSelectStage?: (stage: PerformanceStage) => void;
  onSelectEntity?: (row: NormalizedRow, key: PerformanceStageKey) => void;
  onNavigate?: (tab: "creatives" | "setup" | "drivers") => void;
};

export type FunnelViewState = {
  selectedKey: PerformanceStageKey | null;
  level: FunnelBreakdown;
  segmentKey: string | null;
  briefOpen: boolean;
  drafts: Record<string, FunnelBriefDraft>;
  sort: "spend" | "rate" | "decline";
  query: string;
  visibleCount: number;
  trend: "rate" | "value" | "cost";
  target: string | null;
  explorationOpen: boolean;
};
export const defaultFunnelView: FunnelViewState = { selectedKey: null, level: "adset", segmentKey: null, briefOpen: false, drafts: {}, sort: "spend", query: "", visibleCount: 20, trend: "rate", target: null, explorationOpen: false };

const number = (value: number | null, language: InterfaceLanguage, maximumFractionDigits = 0) => value === null ? "—" : new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits }).format(value);
const percent = (value: number | null, language: InterfaceLanguage) => value === null ? "—" : `${number(value, language, 2)}%`;

export function PerformanceFunnel({ report, previousReport, compareMode, stages, language, compact = false, businessTargets, viewState, onViewStateChange, onOpenFunnel, onEditScope, onSelectStage, onSelectEntity, onNavigate }: Props) {
  const vi = language === "vi";
  const t = (en: string, vn: string) => vi ? vn : en;
  const currency = report.account.currency || "VND";
  const comparableReport = compareMode !== "off" && previousReport?.account.id === report.account.id && previousReport.account.currency === report.account.currency ? previousReport : null;
  const previous = comparableReport?.totals ?? null;
  const suggestion = describeFunnelFocus(stages, report.totals, previous);
  const suggestedKey = suggestion.key;
  const [localView, setLocalView] = React.useState(defaultFunnelView);
  const { selectedKey, level, sort, query, visibleCount, trend, target, explorationOpen, segmentKey, briefOpen, drafts } = viewState ?? localView;
  const explorationId = React.useId();
  const setView = onViewStateChange ?? setLocalView;
  const updateView = (patch: Partial<FunnelViewState>) => setView(current => ({ ...current, ...patch }));
  const breakdownRef = React.useRef<HTMLElement>(null);
  const inspectorRef = React.useRef<HTMLElement>(null);
  const briefRef = React.useRef<HTMLDivElement>(null);
  const jumpTo = (ref: React.RefObject<HTMLElement | null>) => { ref.current?.scrollIntoView({ block: "start" }); ref.current?.focus({ preventScroll: true }); };
  const focus = stages.find(stage => stage.key === (selectedKey ?? suggestedKey)) ?? stages[0];
  const measure = focus ? measureFunnelStage(report.totals, focus.key) : null;
  const priorMeasure = focus && previous ? measureFunnelStage(previous, focus.key) : null;
  const delta = focus ? funnelRateDelta(report.totals, previous, focus.key) : null;
  const selectedValueChange = funnelValueChange(measure?.value ?? null, priorMeasure?.value ?? null);
  if (!focus || !measure) return <section className="plain-panel plain-empty">{t("Choose funnel stages in Customize KPIs to start your analysis.", "Chọn bước phễu trong Tùy chỉnh KPI để bắt đầu phân tích.")}</section>;
  const money = (value: number | null) => value === null ? "—" : formatMetric(value, "currency", currency);
  const comparisonText = comparisonDescriptor({ compareMode, previousReport, language });
  const missing = focus.availability === "not_tracked";
  const lowSample = hasLowFunnelVolume(report.totals, focus.key);
  const deterioration = delta !== null && delta < -0.05;
  const action = nextStep(focus.key, missing, vi);
  const stageLabel = funnelMetricLabel(measure.metric, language);
  const denominatorLabel = measure.denominatorKey ? funnelMetricLabel(measure.denominatorKey, language) : null;
  const primaryKey = primaryFunnelStage(report.selectedPack);
  const finalMeasure = measureFunnelStage(report.totals, primaryKey);
  const priorFinalMeasure = previous ? measureFunnelStage(previous, primaryKey) : null;
  const outcomeChange = funnelValueChange(finalMeasure.value, priorFinalMeasure?.value ?? null);
  const valueChangeText = (current: number | null, prior: number | null) => {
    const change = funnelValueChange(current, prior);
    return change ? `${change.absolute > 0 ? "+" : ""}${number(change.absolute, language, 2)} · ${change.relative === null ? t("relative change unavailable", "chưa có thay đổi tương đối") : `${change.relative > 0 ? "+" : ""}${percent(change.relative, language)}`}` : t("Unavailable", "Chưa có");
  };
  const roas = report.totals.roas > 0 && Number.isFinite(report.totals.roas) ? report.totals.roas : null;
  const previousRoas = previous && previous.roas > 0 && Number.isFinite(previous.roas) ? previous.roas : null;
  const targetCpa = Number(businessTargets?.cpa) > 0 ? Number(businessTargets?.cpa) : null;
  const targetRoas = Number(businessTargets?.roas) > 0 ? Number(businessTargets?.roas) : null;
  const dimensionLabels: Record<FunnelBreakdown, string> = { campaign: t("Campaign", "Chiến dịch"), adset: t("Ad set", "Nhóm quảng cáo"), ad: t("Ad", "Quảng cáo"), platform: t("Platform", "Nền tảng"), region: t("Region", "Khu vực"), ageGender: t("Age / gender", "Tuổi / giới tính"), device: t("Device", "Thiết bị") };
  const select = (key: PerformanceStageKey) => updateView({ selectedKey: key, trend: "rate", target: null });
  const suggestionText = suggestion.reason === "tracking" ? t("Tracking is missing for this step.", "Bước này thiếu dữ liệu theo dõi.") : suggestion.reason === "decline" ? t(`Largest measured rate drop (${number(suggestion.delta, language, 2)} percentage points). Check business outcomes before prioritizing.`, `Mức giảm tỷ lệ lớn nhất đã đo (${number(suggestion.delta, language, 2)} điểm phần trăm). Kiểm tra kết quả kinh doanh trước khi ưu tiên.`) : t("No clear rate drop to prioritize. Choose a step to inspect.", "Chưa thấy mức giảm tỷ lệ rõ để ưu tiên. Chọn một bước để xem xét.");

  const chart = <div className={`funnel-step-grid${compact ? " is-compact" : ""}`} style={{ "--funnel-steps": stages.length } as React.CSSProperties}>
    {stages.map((stage, index) => {
      const current = measureFunnelStage(report.totals, stage.key);
      const prior = previous ? measureFunnelStage(previous, stage.key) : null;
      const change = funnelRateDelta(report.totals, previous, stage.key);
      const baseline = !current.denominatorKey && stage.key !== "saturation" && current.value !== null && current.value > 0;
      const barRate = current.rate ?? (baseline ? 100 : null);
      const selected = !compact && stage.key === focus.key;
      const label = funnelMetricLabel(current.metric, language);
      return <button key={stage.key} type="button" className="funnel-step" aria-pressed={compact ? undefined : selected} onClick={() => compact ? onOpenFunnel?.(stage.key) : select(stage.key)}>
        <span className="funnel-step-heading"><span className="funnel-step-number">{index + 1}</span>{label}<ArrowRightIcon size={13} /></span>
        <strong className="funnel-step-value">{number(current.value, language, stage.key === "saturation" ? 1 : 0)}</strong>
        <span className="funnel-step-rate">{current.rate !== null ? percent(current.rate, language) : baseline ? "100%" : "—"}<small>{current.denominatorKey ? `${t("of", "trên")} ${funnelMetricLabel(current.denominatorKey, language).toLocaleLowerCase()}` : baseline ? t("delivery baseline", "mốc phân phối") : t("ratio unavailable", "chưa có tỷ lệ")}</small></span>
        <span className="funnel-column" aria-hidden="true">
          {barRate !== null ? <span className="funnel-column-fill" style={{ height: `${Math.min(100, barRate)}%` }} /> : <span className="funnel-column-unavailable">{stage.availability === "not_tracked" ? t("Not tracked", "Chưa theo dõi") : t("No ratio", "Chưa có tỷ lệ")}</span>}
          {prior?.rate !== null && prior?.rate !== undefined ? <span className="funnel-column-marker" style={{ bottom: `${Math.min(100, prior.rate)}%` }} /> : null}
        </span>
        <span className="funnel-step-footer" data-direction={change === null || Math.abs(change) < 0.05 ? "neutral" : change < 0 ? "down" : "up"}>
          {change !== null ? `${change > 0 ? "+" : ""}${number(change, language, 2)} ${t("pp", "điểm %")}` : stage.availability === "not_tracked" ? t("Set up tracking", "Thiết lập theo dõi") : money(current.cost)}
          <small>{change !== null ? comparisonText : stage.key === "saturation" ? t("frequency metric", "chỉ số tần suất") : stage.availability === "not_tracked" ? t("outcome unavailable", "chưa có kết quả") : current.metric === "impressions" ? "CPM" : t("per event", "mỗi sự kiện")}</small>
          {change !== null && current.cost !== null ? <small className="funnel-step-cost">{money(current.cost)} · {current.metric === "impressions" ? "CPM" : t("per event", "mỗi sự kiện")}</small> : null}
        </span>
      </button>;
    })}
  </div>;

  if (compact) return <section className="plain-panel funnel-overview">
    <div className="plain-panel-heading"><div><h2>{t("From delivery to outcome", "Từ phân phối đến kết quả")}</h2><p className="funnel-subtitle">{t("See the step worth investigating next.", "Xác định bước cần xem xét tiếp theo.")}</p></div><button type="button" className="plain-text-action" onClick={() => onOpenFunnel?.()}>{t("Explore funnel", "Phân tích phễu")}<ArrowRightIcon size={14} /></button></div>
    {chart}
    <div className="funnel-overview-footer"><span><i />{t("Inspect next", "Xem xét tiếp")}: <b>{stageLabel}</b></span><span>{t("Aggregate event ratios · select a step to explore", "Tỷ lệ sự kiện tổng hợp · chọn một bước để xem chi tiết")}</span></div>
  </section>;

  const allRows = funnelBreakdownRows(report, level);
  const priorRows = comparableReport ? funnelBreakdownRows(comparableReport, level) : [];
  const currentIndex = indexFunnelRows(allRows, level);
  const priorIndex = indexFunnelRows(priorRows, level);
  const rows = allRows.filter(row => [funnelRowLabel(row, level, language), row.campaignName, row.adsetName].some(name => name?.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).map(row => ({ row, measure: measureFunnelStage(row, focus.key), delta: currentIndex.get(funnelRowKey(row, level) ?? "") === row ? funnelRateDelta(row, priorIndex.get(funnelRowKey(row, level) ?? "") ?? null, focus.key) : null }))
    .sort((a, b) => sort === "spend" ? b.row.spend - a.row.spend : sort === "decline" ? (a.delta ?? Infinity) - (b.delta ?? Infinity) : (a.measure.rate ?? Infinity) - (b.measure.rate ?? Infinity));
  const selectedRow = segmentKey ? currentIndex.get(segmentKey) ?? null : null;
  const observation = buildFunnelObservation(report, comparableReport, compareMode, focus.key, level, selectedRow, selectedRow ? funnelRowLabel(selectedRow, level, language) : undefined);
  const draftKey = funnelObservationKey(observation);
  const briefDraft = drafts[draftKey] ?? { hypothesis: "", change: "", guardrails: "", metric: defaultFunnelBriefMetric(report.selectedPack) };
  const isEntity = ["campaign", "adset", "ad"].includes(level);
  const defaultTarget = defaultFunnelTarget(measure.rate, priorMeasure?.rate ?? null);
  const targetNumber = target === null ? Number(defaultTarget.toFixed(2)) : Number(target);
  const scenario = target === null || /^\d*\.?\d+$/.test(target ?? "") ? modelStageTarget(measure.value, measure.denominator, targetNumber) : null;
  const trendKind = trend === "rate" && !measure.denominatorKey ? "value" : trend;
  const trendData = [...report.dailyRows].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).map(row => ({ date: row.date, value: measureFunnelStage(row, focus.key)[trendKind] }));
  const hasTrend = trendData.some(point => point.value !== null);
  const trendLabel = trendKind === "rate" ? t("Step rate", "Tỷ lệ của bước") : trendKind === "cost" ? t("Cost per event", "Chi phí mỗi sự kiện") : stageLabel;
  const formatTrend = (value: number | null) => trendKind === "rate" ? percent(value, language) : trendKind === "cost" ? money(value) : number(value, language, focus.key === "saturation" ? 1 : 0);

  return <div className="funnel-workspace">
    <div className="funnel-context">
      <div><h2>{t("Find where results change", "Tìm nơi kết quả thay đổi")}</h2><p>{t("Compare a step, inspect a segment, then save a hypothesis to test.", "So sánh từng bước, xem từng phân khúc, rồi lưu giả thuyết cần kiểm chứng.")}</p></div>
    </div>
    <details className="funnel-help"><summary><InfoIcon size={14} />{t("How to read this funnel", "Cách đọc phễu này")}</summary><dl>
      <div><dt>{t("What does a step rate mean?", "Tỷ lệ của bước nghĩa là gì?")}</dt><dd>{t("The step's reported events divided by the base shown below it. These are event counts, so one person can appear more than once. This is not a tracked journey of individual people.", "Số sự kiện của bước chia cho số gốc ghi bên dưới. Một người có thể tạo nhiều sự kiện. Đây chưa phải hành trình được nối theo từng người.")}</dd></div>
      <div><dt>{t("What does pp mean?", "Điểm phần trăm là gì?")}</dt><dd>{t("Percentage points: a rate going from 2% to 3% increases by 1 pp. This is different from its 50% relative increase.", "Tỷ lệ từ 2% lên 3% tăng 1 điểm phần trăm (pp). Khác với mức tăng tương đối 50%.")}</dd></div>
      <div><dt>{t("What is the comparison?", "Mốc so sánh là gì?")}</dt><dd>{t("The period selected in Compare, shown beside the current dates. A dash (—) means a measurement or matching comparison is unavailable, not zero.", "Kỳ được chọn trong mục So sánh, hiển thị cạnh ngày hiện tại. Dấu — là thiếu phép đo hoặc dữ liệu tương ứng, không phải bằng 0.")}</dd></div>
      <div><dt>{t("How do I use the finding?", "Dùng phát hiện này như thế nào?")}</dt><dd>{t("Start here highlights missing tracking or the largest rate drop with at least 30 base events. It does not rank business impact. Check volume, cost and quality, then select a segment and save a possible explanation in Hypothesis.", "Bắt đầu từ đây chỉ ra thiếu theo dõi hoặc mức giảm tỷ lệ lớn nhất với ít nhất 30 sự kiện gốc. Đây chưa phải xếp hạng tác động kinh doanh. Kiểm tra số lượng, chi phí và chất lượng, rồi chọn phân khúc và lưu cách giải thích trong Giả thuyết.")}</dd></div>
    </dl></details>
    <div className="funnel-summary-strip">
      <div><span>{t("Main result", "Kết quả chính")} · {funnelMetricLabel(finalMeasure.metric, language)}</span><strong>{number(finalMeasure.value, language)}<small>{finalMeasure.value === null ? t("Tracking missing", "Thiếu dữ liệu theo dõi") : primaryKey === "reach" ? t("people reached", "người tiếp cận") : t("recorded events", "sự kiện ghi nhận")}</small></strong><p className="funnel-summary-note">{t("Baseline", "Mốc so sánh")}: {number(priorFinalMeasure?.value ?? null, language)}<br />{t("Change", "Thay đổi")}: {valueChangeText(finalMeasure.value, priorFinalMeasure?.value ?? null)}</p>{report.selectedPack === "sales_roas" ? <p className="funnel-summary-note"><b>ROAS {roas === null ? "—" : `${number(roas, language, 2)}×`}</b> · {t("baseline", "mốc")}: {previousRoas === null ? "—" : `${number(previousRoas, language, 2)}×`}{roas === null ? <small>{t("ROAS value unavailable; revenue coverage is not established.", "Chưa có ROAS; chưa xác định được độ phủ dữ liệu doanh thu.")}</small> : null}</p> : null}</div>
      <div><span>{t("Cost per result", "Chi phí mỗi kết quả")}</span><strong>{money(finalMeasure.cost)}</strong><p className="funnel-summary-note">{t("Baseline", "Mốc so sánh")}: {money(priorFinalMeasure?.cost ?? null)}<br />{t("Change", "Thay đổi")}: {percent(funnelValueChange(finalMeasure.cost, priorFinalMeasure?.cost ?? null)?.relative ?? null, language)}</p><p className="funnel-summary-note">{t("Spend", "Chi tiêu")}: {money(report.totals.spend)}<br />{t("Baseline spend", "Chi tiêu mốc")}: {money(previous?.spend ?? null)}</p></div>
      <div><span>{t("Start here", "Bắt đầu từ đây")}</span><button type="button" onClick={() => suggestedKey && select(suggestedKey)}>{funnelMetricLabel(measureFunnelStage(report.totals, suggestedKey ?? focus.key).metric, language)}<ArrowRightIcon size={14} /></button><p className="funnel-summary-note">{suggestionText}</p>{suggestion.reason === "decline" && outcomeChange && outcomeChange.absolute >= 0 ? <p className="funnel-summary-note"><b>{t("Main result is holding or improving.", "Kết quả chính đang giữ ổn định hoặc tăng.")}</b></p> : null}</div>
      <div><span>{t("Comparison", "So sánh")}</span><strong className="funnel-summary-text">{previous ? comparisonText : t("No baseline loaded", "Chưa có mốc so sánh")}</strong><p className="funnel-summary-note">{report.dateRange.since} – {report.dateRange.until}{comparableReport ? <><br />{t("vs", "so với")} {comparableReport.dateRange.since} – {comparableReport.dateRange.until}</> : null}</p><p className="funnel-summary-note">{t("Configured targets", "Mục tiêu đã đặt")}: {targetCpa !== null || targetRoas !== null ? <>{targetCpa !== null ? `CPA ${money(targetCpa)}` : ""}{targetCpa !== null && targetRoas !== null ? " · " : ""}{targetRoas !== null ? `ROAS ${number(targetRoas, language, 2)}×` : ""}</> : t("Not set", "Chưa đặt")}</p><button type="button" className="plain-text-action" onClick={onEditScope}>{previous ? t("Edit scope or targets", "Sửa phạm vi hoặc mục tiêu") : t("Choose comparison", "Chọn mốc so sánh")}</button></div>
    </div>

    <div className="funnel-analysis-layout">
      <section className="plain-panel funnel-chart-panel" aria-label={t("Funnel steps", "Các bước phễu")}>
        <div className="plain-panel-heading"><div><h3>{t("Step performance", "Hiệu suất từng bước")}</h3><p className="funnel-subtitle">{t("Select a step to update the analysis below.", "Chọn bước để cập nhật phân tích bên dưới.")}</p></div><div className="funnel-legend"><span><i />{t("Current", "Hiện tại")}</span>{previous ? <span><i />{t("Baseline", "Mốc so sánh")}</span> : null}</div></div>
        {chart}
        <button type="button" className="plain-text-action funnel-mobile-jump" onClick={() => jumpTo(inspectorRef)}>{t("Analyze selected step", "Phân tích bước đã chọn")} · {stageLabel}<ArrowRightIcon size={14} /></button>
        <div className="funnel-data-note"><InfoIcon size={14} /><div><p>{t("Counts may include repeated events. Each rate uses the two counts shown.", "Sự kiện có thể lặp. Mỗi tỷ lệ dùng hai số đếm hiển thị tại bước đó.")}</p><details className="funnel-details"><summary>{t("Details", "Chi tiết")}<ChevronDownIcon size={12} /></summary><p>{t("Each ratio uses the denominator shown. Events can overlap or repeat, so ratios can exceed 100%; bars stop at 100%. Missing tracking is unavailable, not zero.", "Tỷ lệ dùng mẫu số ghi trên mỗi bước. Sự kiện có thể trùng hoặc lặp lại nên tỷ lệ có thể vượt 100%; cột giới hạn ở 100%. Thiếu theo dõi nghĩa là chưa có dữ liệu, không phải bằng 0.")}</p></details></div></div>
      </section>

      <aside ref={inspectorRef} tabIndex={-1} className="plain-panel funnel-inspector" aria-label={t("Selected stage analysis", "Phân tích bước đã chọn")}>
        <div className="funnel-inspector-metrics">
          <div className="funnel-inspector-label"><span>{t("Selected step", "Bước đã chọn")}</span><span className="funnel-status" data-warning={missing || deterioration}>{missing ? t("Tracking gap", "Thiếu theo dõi") : deterioration ? t("Rate declined", "Tỷ lệ giảm") : t("Investigate", "Xem xét")}</span></div>
          <h3>{stageLabel}</h3><div className="funnel-inspector-rate">{measure.denominatorKey ? percent(measure.rate, language) : number(measure.value, language, 1)}</div>
          <p className="funnel-subtitle">{denominatorLabel ? `${number(measure.value, language)} / ${number(measure.denominator, language)} ${denominatorLabel.toLocaleLowerCase()}` : focus.efficiency}</p>
          <div className="funnel-delta" data-direction={delta !== null && delta < 0 ? "down" : "up"}>{delta !== null ? <>{delta < 0 ? <ArrowDownRightIcon size={16} /> : <ArrowUpRightIcon size={16} />}{delta > 0 ? "+" : ""}{number(delta, language, 2)} {t("pp", "điểm %")} <span>{t("vs", "so với")} {percent(priorMeasure?.rate ?? null, language)}</span></> : <span>{previous ? t("Comparable rate unavailable", "Chưa có tỷ lệ tương ứng") : t("Load a comparison to measure change", "Chọn mốc so sánh để đo thay đổi")}</span>}</div>
          <dl className="funnel-stage-comparison"><div><dt>{t("Current / baseline", "Hiện tại / mốc")}</dt><dd>{number(measure.value, language)} / {number(priorMeasure?.value ?? null, language)}<small>{valueChangeText(measure.value, priorMeasure?.value ?? null)}</small></dd></div>{measure.denominatorKey ? <div><dt>{denominatorLabel}</dt><dd>{number(measure.denominator, language)} / {number(priorMeasure?.denominator ?? null, language)}</dd></div> : null}</dl>
          {measure.cost !== null ? <div className="funnel-inspector-cost"><span>{measure.metric === "impressions" ? "CPM" : t("Cost per event", "Chi phí mỗi sự kiện")}</span><strong>{money(measure.cost)}</strong></div> : null}
        </div>
        <div className="funnel-inspector-guidance">
          <h4 className="funnel-guidance-heading">{t("What to check", "Cần kiểm tra")}</h4><p className="funnel-action-copy">{action.detail}</p>
          {delta !== null && delta >= 0 && selectedValueChange && selectedValueChange.absolute < 0 ? <p className="funnel-sample-note">{t("Volume fell while the event ratio held or improved. Check the denominator change before blaming efficiency.", "Số lượng giảm trong khi tỷ lệ ổn định hoặc tăng. Kiểm tra thay đổi mẫu số trước khi kết luận hiệu quả giảm.")}</p> : null}
          {lowSample || focus.key === "lead" ? <div className="funnel-cautions">{lowSample ? <span className="funnel-status" data-warning="true">{measure.value === 0 ? t("0 events recorded", "Ghi nhận 0 sự kiện") : t("Low event volume", "Ít sự kiện")}</span> : null}{focus.key === "lead" ? <span className="funnel-status">{t("Lead quality unavailable", "Chưa có chất lượng lead")}</span> : null}</div> : null}
          <Button size="sm" onClick={() => action.tab === "drivers" ? jumpTo(breakdownRef) : onNavigate?.(action.tab)}>{action.label}<ArrowRightIcon size={14} /></Button>
          <button type="button" className="plain-text-action" onClick={() => onSelectStage?.(focus)}>{t("View stage evidence", "Xem bằng chứng của bước")}<ArrowRightIcon size={13} /></button>
          {lowSample || focus.key === "lead" ? <details key={focus.key} className="funnel-details funnel-stage-details"><summary>{t("Details", "Chi tiết")}<ChevronDownIcon size={12} /></summary>{lowSample ? <p>{t("Fewer than 30 events or denominator events: treat this as an early signal. This caution is not a statistical confidence test.", "Có dưới 30 sự kiện hoặc sự kiện mẫu số: chỉ nên xem là tín hiệu ban đầu. Đây không phải kiểm định độ tin cậy thống kê.")}</p> : null}{focus.key === "lead" ? <p>{t("Meta lead events do not establish lead quality. CRM qualification and sales outcomes are needed to assess business quality.", "Sự kiện lead của Meta chưa chứng minh chất lượng lead. Cần dữ liệu phân loại CRM và bán hàng để đánh giá chất lượng kinh doanh.")}</p> : null}{!missing && measure.value === 0 ? <p>{t("Check delivery and tracking before changing spend.", "Kiểm tra phân phối và theo dõi trước khi đổi chi tiêu.")}</p> : null}</details> : null}
        </div>
      </aside>
    </div>

    <section ref={breakdownRef} tabIndex={-1} className="plain-panel funnel-breakdown">
      <div className="plain-panel-heading"><div><h3>{t("Which segment needs attention?", "Phân khúc nào cần xem xét?")}</h3><p className="funnel-subtitle">{stageLabel} · {t("Compare this step by segment. Select a row to use its evidence in a hypothesis.", "So sánh bước này theo phân khúc. Chọn một dòng để dùng dữ liệu đó cho giả thuyết.")}</p></div></div>
      <div className="funnel-table-toolbar"><label>{t("Break down by", "Phân tích theo")}<select aria-label={t("Break down by", "Phân tích theo")} value={level} onChange={event => updateView({ level: event.target.value as FunnelBreakdown, query: "", segmentKey: null, visibleCount: 20 })}>{(Object.keys(dimensionLabels) as FunnelBreakdown[]).map(key => <option key={key} value={key}>{dimensionLabels[key]}{key === "device" ? t(" · data required", " · cần dữ liệu") : ""}</option>)}</select></label><input type="search" aria-label={t("Search funnel breakdown", "Tìm trong phân tích phễu")} placeholder={t("Search by name…", "Tìm theo tên…")} value={query} onChange={event => updateView({ query: event.target.value, visibleCount: 20 })} /><label>{t("Sort", "Sắp xếp")}<select value={sort} onChange={event => updateView({ sort: event.target.value as FunnelViewState["sort"] })}><option value="spend">{t("Highest spend", "Chi tiêu cao nhất")}</option><option value="rate">{t("Lowest step rate", "Tỷ lệ bước thấp nhất")}</option>{previous ? <option value="decline">{t("Biggest rate decline", "Tỷ lệ giảm nhiều nhất")}</option> : null}</select></label></div>
      {selectedRow ? <div className="funnel-selected-segment"><span>{t("Investigating", "Đang xem xét")}: <b>{funnelRowLabel(selectedRow, level, language)}</b><small>{t("The summary above still covers the full report scope.", "Tóm tắt phía trên vẫn bao gồm toàn bộ phạm vi báo cáo.")}</small></span><button type="button" className="plain-text-action" onClick={() => updateView({ segmentKey: null })}>{t("Use all report results", "Dùng toàn bộ kết quả báo cáo")}</button></div> : null}
      <p className="funnel-mobile-table-hint">{t("Swipe the table to compare change, cost and spend share.", "Vuốt bảng để xem thay đổi, chi phí và tỷ trọng chi.")}</p>
      <div className="funnel-table-scroll"><table><thead><tr><th scope="col">{dimensionLabels[level]}</th><th scope="col">{t("Spend", "Chi tiêu")}</th><th scope="col">{stageLabel}</th><th scope="col">{t("Step rate", "Tỷ lệ của bước")}</th>{previous ? <th scope="col">{t("Change (pp)", "Đổi (điểm %)")}</th> : null}<th scope="col">{measure.metric === "impressions" ? "CPM" : t("Cost / event", "Chi phí / sự kiện")}</th><th scope="col">{t("Spend share", "Tỷ trọng chi")}</th></tr></thead><tbody>{rows.slice(0, visibleCount).map(({ row, measure: item, delta: rowDelta }, index) => {
        const key = funnelRowKey(row, level);
        const canSelect = key !== null && currentIndex.get(key) === row;
        const name = funnelRowLabel(row, level, language);
        return <tr key={`${row.id}-${index}`} data-selected={selectedRow === row}><th scope="row"><button type="button" aria-label={`${t("Investigate", "Xem xét")} ${name}`} aria-pressed={selectedRow === row} disabled={!canSelect} onClick={() => { updateView({ segmentKey: key, briefOpen: true }); requestAnimationFrame(() => jumpTo(briefRef)); }}>{name}<ArrowRightIcon size={13} /></button><small>{item.denominatorKey ? `${number(item.denominator, language)} ${funnelMetricLabel(item.denominatorKey, language).toLocaleLowerCase()}` : t("Delivery metric", "Chỉ số phân phối")}</small>{isEntity ? <button type="button" className="plain-text-action funnel-row-evidence" aria-label={`${t("Evidence for", "Bằng chứng của")} ${name}`} onClick={() => onSelectEntity?.(row, focus.key)}>{t("Evidence", "Bằng chứng")}</button> : null}</th><td>{money(row.spend)}</td><td>{number(item.value, language, focus.key === "saturation" ? 1 : 0)}</td><td>{percent(item.rate, language)}{hasLowFunnelVolume(row, focus.key) ? <small>{t("Small sample", "Mẫu nhỏ")}</small> : null}</td>{previous ? <td data-direction={rowDelta !== null && rowDelta < 0 ? "down" : "up"}>{rowDelta === null ? <span title={t("No unique matched baseline with a usable denominator", "Chưa có mốc tương ứng duy nhất với mẫu số khả dụng")}>—</span> : `${rowDelta > 0 ? "+" : ""}${number(rowDelta, language, 2)}`}</td> : null}<td>{money(item.cost)}</td><td><span className="funnel-share"><i style={{ width: `${Math.min(100, report.totals.spend > 0 ? row.spend / report.totals.spend * 100 : 0)}%` }} /></span>{percent(report.totals.spend > 0 ? row.spend / report.totals.spend * 100 : null, language)}</td></tr>;
      })}</tbody></table></div>
      {!rows.length ? <div className="plain-empty">{level === "device" ? t("Device performance is not connected. Device targeting does not measure visitor behavior. Landing-page conversion and load speed also need their own measurements.", "Chưa kết nối hiệu quả theo thiết bị. Nhắm mục tiêu thiết bị không đo hành vi truy cập. Chuyển đổi và tốc độ trang đích cũng cần phép đo riêng.") : query ? t("No names match your search.", "Không có tên phù hợp.") : t("No breakdown data in this scope. This dimension requires a source that reports the selected metric.", "Chưa có dữ liệu trong phạm vi này. Cần nguồn báo cáo chỉ số đã chọn theo chiều phân tích này.")}{query ? <button type="button" className="plain-text-action" onClick={() => updateView({ query: "" })}>{t("Clear search", "Xóa tìm kiếm")}</button> : <button type="button" className="plain-text-action" onClick={() => onNavigate?.("setup")}>{t("Check setup", "Kiểm tra thiết lập")}</button>}</div> : <p className="funnel-table-footnote">{t(`${Math.min(visibleCount, rows.length)} of ${rows.length} · Select a row to investigate.`, `${Math.min(visibleCount, rows.length)}/${rows.length} · Chọn dòng để xem xét.`)}{previous ? ` ${isEntity ? t("Each entity is matched across periods. — means no matching comparison data.", "So cùng đối tượng giữa hai kỳ. — nghĩa là chưa có dữ liệu so sánh tương ứng.") : t("Each segment is matched across periods. — means no unique matching comparison.", "So cùng phân khúc giữa hai kỳ. — nghĩa là chưa có dữ liệu tương ứng duy nhất.")}` : ""}</p>}
      {rows.length > visibleCount ? <button type="button" className="plain-text-action funnel-load-more" onClick={() => updateView({ visibleCount: visibleCount + 20 })}>{t("Show 20 more", "Hiện thêm 20")}</button> : null}
    </section>

    <div ref={briefRef} tabIndex={-1} className="funnel-brief-anchor" aria-label={t("Hypothesis", "Giả thuyết")}><FunnelTestBriefPanel observation={observation} language={language} draft={briefDraft} expanded={briefOpen} onExpandedChange={open => updateView({ briefOpen: open })} onDraftChange={draft => setView(current => ({ ...current, drafts: { ...current.drafts, [draftKey]: draft } }))} /></div>

    <section className="funnel-exploration">
      <h3><button type="button" className="plain-panel funnel-exploration-toggle" aria-expanded={explorationOpen} aria-controls={explorationId} onClick={() => updateView({ explorationOpen: !explorationOpen })}><span>{t("Trends and what-if analysis", "Xu hướng và phân tích giả định")}<small>{t("Optional exploration", "Phân tích thêm")} · {stageLabel}</small></span><ChevronDownIcon size={16} /></button></h3>
      <div id={explorationId} hidden={!explorationOpen}>
        {explorationOpen ? (
          <div className="funnel-detail-layout">
            <section className="plain-panel funnel-trend-panel">
              <div className="plain-panel-heading"><div><h3>{stageLabel} · {t("daily trend", "xu hướng ngày")}</h3><p className="funnel-subtitle">{trendKind === "rate" ? `${stageLabel} / ${denominatorLabel}` : trendLabel}</p></div><div className="funnel-segment-control" aria-label={t("Trend metric", "Chỉ số xu hướng")}>{(["rate", "value", "cost"] as const).filter(key => key !== "rate" || measure.denominatorKey).filter(key => key !== "cost" || focus.key !== "saturation").map(key => <button key={key} type="button" aria-pressed={trendKind === key} onClick={() => updateView({ trend: key })}>{key === "rate" ? t("Rate", "Tỷ lệ") : key === "value" ? t("Volume", "Số lượng") : t("Cost", "Chi phí")}</button>)}</div></div>
              {hasTrend ? <div className="funnel-trend-chart"><ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}><AreaChart data={trendData} margin={{ top: 12, right: 12, left: 2, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" /><XAxis dataKey="date" tickFormatter={(date: string) => date?.slice(5)} axisLine={false} tickLine={false} minTickGap={30} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} /><YAxis width={66} axisLine={false} tickLine={false} tickFormatter={(value: number) => trendKind === "rate" ? `${number(value, language, 1)}%` : new Intl.NumberFormat(vi ? "vi-VN" : "en-US", { notation: "compact" }).format(value)} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} /><Tooltip labelFormatter={label => String(label)} formatter={value => [formatTrend(Number(value)), trendLabel]} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12 }} /><Area type="linear" dataKey="value" stroke="var(--plain-chart)" fill="var(--plain-chart)" fillOpacity={0.07} strokeWidth={2} connectNulls={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <div className="plain-empty">{t("Daily data unavailable for this metric.", "Chưa có dữ liệu ngày cho chỉ số này.")}</div>}
            </section>

            <section className="plain-panel funnel-scenario">
              <div className="plain-panel-heading"><div><h3>{t("What if this rate improved?", "Nếu tỷ lệ này tốt hơn thì sao?")}</h3><p className="funnel-subtitle">{t("Estimate for this step only", "Chỉ ước tính cho bước này")}</p></div></div>
              {measure.rate !== null && measure.rate <= 100 && measure.denominator !== null && measure.denominator >= 30 ? <><label htmlFor="funnel-target">{t("Rate to explore", "Tỷ lệ muốn thử")}<span className="funnel-target-input"><input id="funnel-target" type="number" min="0" max="100" step="0.01" value={target === null ? Number(targetNumber.toFixed(2)) : target} onChange={event => updateView({ target: event.target.value })} aria-invalid={scenario === null} />%</span></label>
                {scenario ? <div className="funnel-scenario-result"><strong>{scenario.additional > 0 ? "+" : ""}{number(scenario.additional, language, 1)}</strong><span>{stageLabel.toLocaleLowerCase()} {t("vs current", "so với hiện tại")}</span></div> : <p className="funnel-sample-note">{t("Enter a rate from 0 to 100.", "Nhập tỷ lệ từ 0 đến 100.")}</p>}
                <p className="funnel-subtitle">{t(`Keeps the base at ${number(measure.denominator, language)} events. This is a what-if estimate; spend and later steps are not predicted. No changes are applied.`, `Giữ số gốc ở ${number(measure.denominator, language)} sự kiện. Đây là giả định, không dự báo chi tiêu hay bước sau. Chưa áp dụng thay đổi nào.`)}</p></> : <p className="funnel-action-copy">{t("A tracked ratio between 0–100% and at least 30 denominator events is needed to model a target for this step.", "Cần tỷ lệ đã theo dõi từ 0–100% và mẫu số tối thiểu 30 sự kiện để thử mục tiêu cho bước này.")}</p>}
            </section>
          </div>
        ) : null}
      </div>
    </section>
  </div>;
}

function nextStep(key: PerformanceStageKey, missing: boolean, vi: boolean): { tab: "setup" | "creatives" | "drivers"; label: string; detail: string } {
  if (missing) return { tab: "setup", label: vi ? "Kiểm tra thiết lập" : "Check setup", detail: vi ? "Kiểm tra sự kiện và nguồn dữ liệu. Thiếu theo dõi không có nghĩa là không có chuyển đổi." : "Verify the event and its data source. Missing tracking does not mean zero conversions." };
  if (key === "traffic" || key === "saturation") return { tab: "creatives", label: vi ? "Xem creative" : "Review creatives", detail: vi ? "Kiểm tra phản hồi creative ở nhóm chi nhiều nhưng hiệu quả thấp." : "Check creative response in segments with high spend and low efficiency." };
  if (["cart", "checkout", "purchase", "replies"].includes(key)) return { tab: "setup", label: vi ? "Kiểm tra thiết lập" : "Check setup", detail: vi ? "Xác minh theo dõi sự kiện và trải nghiệm sau click." : "Verify event tracking and the experience after the click." };
  return { tab: "drivers", label: vi ? "So sánh phân khúc" : "Compare segments", detail: vi ? "Tìm nhóm chi nhiều nhưng tỷ lệ sự kiện thấp." : "Find high-spend segments with weak event ratios." };
}
