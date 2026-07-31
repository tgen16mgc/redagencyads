"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangleIcon, CheckCircle2Icon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import type { DashboardReport, InterfaceLanguage } from "@/lib/types";
import { metricValue, type ChartKey } from "@/lib/chart-spec";
import {
  type CustomAxis,
  type CustomChartSpec,
  type CustomChartType,
  CHART_PRESETS,
  MAX_SERIES,
  addSeries,
  canAddSeries,
  getBuilderMetricCatalog,
  metricFormat,
  metricLabel,
  presetToSpec,
  removeSeries,
  setSeriesAxis,
  validateSpec,
} from "@/lib/custom-chart";
import { CustomChartCard, CustomChartPreview } from "@/components/dashboard/custom-chart-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Copy = {
  trigger: string;
  title: string;
  description: string;
  close: string;
  adaptive: string;
  adaptiveDetail: string;
  tabPresets: string;
  tabCustom: string;
  presetAdd: string;
  titlePlaceholder: string;
  typeLabel: string;
  metricLabel: string;
  leftAxis: string;
  rightAxis: string;
  leftEmpty: string;
  rightEmpty: string;
  needsMetrics: string;
  needsMetricsDetail: string;
  valid: string;
  validDetail: string;
  limit: string;
  limitDetail: string;
  previewEmpty: string;
  previewEmptyDetail: string;
  save: string;
  done: string;
  remove: string;
  savedLabel: string;
  savedEmpty: string;
  types: Record<CustomChartType, string>;
};

const COPY: Record<InterfaceLanguage, Copy> = {
  en: {
    trigger: "Build custom chart",
    title: "Build a custom chart",
    description: "Compose evidence without changing the active KPI pack.",
    close: "Close",
    adaptive: "Adaptive metrics",
    adaptiveDetail: "Availability follows the selected pack; missing values stay unavailable.",
    tabPresets: "Presets",
    tabCustom: "Custom",
    presetAdd: "Add",
    titlePlaceholder: "Chart title (required)",
    typeLabel: "Chart type",
    metricLabel: "Metrics · add or drag",
    leftAxis: "Left axis",
    rightAxis: "Right axis · optional",
    leftEmpty: "Drop the first metric here",
    rightEmpty: "Use only for a second format",
    needsMetrics: "Needs metrics",
    needsMetricsDetail: "Choose 1–5 metrics. Mixed formats may require the right axis.",
    valid: "Valid composition",
    validDetail: "Metric formats are separated across compatible axes.",
    limit: "5 metric limit",
    limitDetail: "Remove or replace a series before adding another metric.",
    previewEmpty: "Preview appears after the first metric",
    previewEmptyDetail: "Choose a metric or start from a preset. No zero-value series are fabricated.",
    save: "Save chart",
    done: "Done",
    remove: "Remove chart",
    savedLabel: "Saved charts",
    savedEmpty: "No custom charts saved yet.",
    types: { line: "Line", bar: "Bar", area: "Area", composed: "Composed" },
  },
  vi: {
    trigger: "Tạo biểu đồ riêng",
    title: "Tạo biểu đồ tùy chỉnh",
    description: "Tạo evidence mà không thay đổi bộ KPI đang dùng.",
    close: "Đóng",
    adaptive: "Chỉ số thích ứng",
    adaptiveDetail: "Chỉ số phụ thuộc bộ KPI; dữ liệu thiếu luôn được ghi rõ.",
    tabPresets: "Mẫu sẵn",
    tabCustom: "Tùy chỉnh",
    presetAdd: "Thêm",
    titlePlaceholder: "Tiêu đề biểu đồ (bắt buộc)",
    typeLabel: "Loại biểu đồ",
    metricLabel: "Chỉ số · thêm hoặc kéo",
    leftAxis: "Trục trái",
    rightAxis: "Trục phải · tùy chọn",
    leftEmpty: "Thả chỉ số đầu tiên vào đây",
    rightEmpty: "Chỉ dùng cho định dạng thứ hai",
    needsMetrics: "Cần chọn chỉ số",
    needsMetricsDetail: "Chọn 1–5 chỉ số. Định dạng khác nhau có thể cần trục phải.",
    valid: "Bố cục hợp lệ",
    validDetail: "Các định dạng chỉ số đã được chia vào trục tương thích.",
    limit: "Giới hạn 5 chỉ số",
    limitDetail: "Xóa hoặc thay một chuỗi trước khi thêm chỉ số khác.",
    previewEmpty: "Preview xuất hiện sau chỉ số đầu tiên",
    previewEmptyDetail: "Chọn chỉ số hoặc bắt đầu bằng mẫu sẵn. Hệ thống không tạo dữ liệu 0 giả.",
    save: "Lưu biểu đồ",
    done: "Xong",
    remove: "Xóa biểu đồ",
    savedLabel: "Biểu đồ đã lưu",
    savedEmpty: "Chưa lưu biểu đồ tùy chỉnh nào.",
    types: { line: "Đường", bar: "Cột", area: "Vùng", composed: "Kết hợp" },
  },
};

const CHART_TYPES: CustomChartType[] = ["composed", "line", "bar", "area"];

const PRESET_PRESENTATION: Record<string, { name: string; description: string }> = {
  "preset-cpl-leads": { name: "Outcome + cost", description: "Primary result with CPA, CPL, CPC or cost/message." },
  "preset-purchases-roas": { name: "Delivery quality", description: "Spend, reach and frequency with efficiency context." },
  "preset-messages-costpermsg": { name: "Funnel efficiency", description: "Stage volume, rate, unit cost and benchmark." },
  "preset-clicks-ctr": { name: "Saturation watch", description: "Reach growth, CPM pressure and frequency risk." },
  "preset-frequency-ctr": { name: "Creative fatigue", description: "CTR decay, frequency and creative-level results." },
  "preset-cpm-reach": { name: "Spend pace", description: "Daily spend against target and remaining opportunity." },
};

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `chart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDraft(): CustomChartSpec {
  return { id: "draft", title: "", type: "composed", xKey: "date", series: [], dualAxis: false };
}

function preserveTitle(previous: CustomChartSpec, next: CustomChartSpec): CustomChartSpec {
  return { ...next, title: previous.title };
}

function autoFixAxes(spec: CustomChartSpec): CustomChartSpec {
  const formats = [...new Set(spec.series.map((series) => metricFormat(series.key)))];
  const leftFormat = formats[0];
  const rightFormat = formats[1];
  return {
    ...spec,
    series: spec.series.map((series) => ({
      ...series,
      axis: metricFormat(series.key) === leftFormat || !rightFormat ? "left" : "right",
    })),
    dualAxis: formats.length > 1,
  };
}

function previewDescription(spec: CustomChartSpec, language: InterfaceLanguage): string {
  const left = spec.series.filter((series) => series.axis === "left").map((series) => metricLabel(series.key, language)).join(" + ");
  const right = spec.series.filter((series) => series.axis === "right").map((series) => metricLabel(series.key, language)).join(" + ");
  if (spec.type === "composed") return [left ? `${left} bars` : "", right ? `${right} right axis` : ""].filter(Boolean).join(" · ");
  const type = language === "vi" ? COPY.vi.types[spec.type] : COPY.en.types[spec.type];
  return [left, right ? `${right} right axis` : "", type].filter(Boolean).join(" · ");
}

export function CustomChartsSection({
  report,
  language,
  saved,
  onSavedChange,
  controllerOnly = false,
}: {
  report: DashboardReport;
  language: InterfaceLanguage;
  saved: CustomChartSpec[];
  onSavedChange: React.Dispatch<React.SetStateAction<CustomChartSpec[]>>;
  controllerOnly?: boolean;
}) {
  const copy = COPY[language];
  const currency = report.account.currency || "VND";
  const catalog = getBuilderMetricCatalog(language);
  const [open, setOpen] = React.useState(false);
  const [builderTab, setBuilderTab] = React.useState("presets");
  const [draft, setDraft] = React.useState<CustomChartSpec>(emptyDraft);
  const [dragKey, setDragKey] = React.useState<ChartKey | null>(null);
  const [dropAxis, setDropAxis] = React.useState<CustomAxis | null>(null);
  const [savedConfirmation, setSavedConfirmation] = React.useState(false);
  const draftValidation = validateSpec(draft);
  const compositionIssues = draftValidation.issues.filter((issue) => issue.code !== "EMPTY_SERIES");
  const hasTitle = Boolean(draft.title.trim());
  const canSave = hasTitle && draft.series.length > 0 && compositionIssues.length === 0;
  const atLimit = draft.series.length === MAX_SERIES;
  const addedKeys = new Set(draft.series.map((series) => series.key));
  const unavailableSeries = draft.series.find((series) => report.dailyRows.every((row) => metricValue(row, series.key) <= 0));

  const resetBuilder = React.useCallback(() => {
    setBuilderTab("presets");
    setDraft(emptyDraft());
    setSavedConfirmation(false);
    setDragKey(null);
    setDropAxis(null);
  }, []);

  React.useEffect(() => {
    const openBuilder = () => {
      resetBuilder();
      setOpen(true);
    };
    window.addEventListener("v2:open-custom-chart", openBuilder);
    return () => window.removeEventListener("v2:open-custom-chart", openBuilder);
  }, [resetBuilder]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) resetBuilder();
    setOpen(nextOpen);
  }

  function updateDraft(updater: (current: CustomChartSpec) => CustomChartSpec) {
    setSavedConfirmation(false);
    setDraft(updater);
  }

  function handleAddPreset(presetId: string) {
    const preset = CHART_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    onSavedChange((current) => [...current, presetToSpec(preset, language, newId())]);
    toast.success(language === "vi" ? "Đã thêm biểu đồ" : "Chart added", {
      description: PRESET_PRESENTATION[preset.id]?.name || preset.nameEn,
    });
  }

  function handleMetricClick(key: ChartKey) {
    updateDraft((current) => {
      if (current.series.some((series) => series.key === key)) return preserveTitle(current, removeSeries(current, key));
      return canAddSeries(current) ? preserveTitle(current, addSeries(current, key)) : current;
    });
  }

  function handleSetAxis(key: ChartKey, axis: CustomAxis) {
    updateDraft((current) => preserveTitle(current, setSeriesAxis(current, key, axis)));
  }

  function handleDropOnAxis(axis: CustomAxis) {
    const key = dragKey;
    setDragKey(null);
    setDropAxis(null);
    if (!key) return;
    updateDraft((current) => current.series.some((series) => series.key === key)
      ? preserveTitle(current, setSeriesAxis(current, key, axis))
      : canAddSeries(current)
        ? preserveTitle(current, addSeries(current, key, axis))
        : current);
  }

  function handleSaveDraft() {
    if (!canSave) return;
    onSavedChange((current) => [...current, { ...draft, id: newId() }]);
    setSavedConfirmation(true);
    toast.success(language === "vi" ? "Đã lưu biểu đồ tùy chỉnh" : "Custom chart saved", { description: draft.title });
  }

  function handleRemoveSaved(id: string) {
    onSavedChange((current) => current.filter((spec) => spec.id !== id));
    toast.success(language === "vi" ? "Đã xóa biểu đồ" : "Chart removed");
  }

  const axisCard = (axis: CustomAxis) => {
    const axisSeries = draft.series.filter((series) => series.axis === axis);
    const dragging = dropAxis === axis;
    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDropAxis(axis);
        }}
        onDragLeave={() => setDropAxis((current) => current === axis ? null : current)}
        onDrop={(event) => {
          event.preventDefault();
          handleDropOnAxis(axis);
        }}
        className={cn(
          "flex min-h-[92px] min-w-0 flex-1 flex-col gap-2 overflow-hidden rounded-2xl border px-3.5 py-3 transition-colors",
          dragging ? "border-primary bg-primary/10" : "border-border bg-secondary/70",
        )}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.04em]">{axis === "left" ? copy.leftAxis : copy.rightAxis}</div>
        {axisSeries.length ? (
          <div className="flex flex-wrap gap-1.5">
            {axisSeries.map((series) => (
              <Button
                key={series.key}
                type="button"
                variant={axis === "left" ? "default" : "secondary"}
                size="xs"
                className={cn("h-5 min-w-0 rounded-full px-1.5 text-xs", axis === "right" && "bg-warning/15 text-warning hover:bg-warning/20")}
                title={language === "vi" ? "Bấm để chuyển trục" : "Click to move to the other axis"}
                onClick={() => handleSetAxis(series.key, axis === "left" ? "right" : "left")}
              >
                {metricLabel(series.key, language)}
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">{dragging && dragKey ? `${language === "vi" ? "Thả" : "Drop"} ${metricLabel(dragKey, language)}` : axis === "left" ? copy.leftEmpty : copy.rightEmpty}</div>
        )}
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-4" data-print-flow>
      <div className={controllerOnly ? "hidden" : "flex items-center justify-between gap-3"} data-print-hidden>
        <div>
          <h3 className="font-heading text-sm font-medium text-foreground">{copy.savedLabel}</h3>
          {saved.length === 0 ? <p className="text-xs text-muted-foreground">{copy.savedEmpty}</p> : null}
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger render={<Button variant="outline" size="sm"><SlidersHorizontalIcon />{copy.trigger}</Button>} />
          <DialogContent className="flex h-[min(900px,calc(100svh-2rem))] max-w-[620px] flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-popover p-4" showCloseButton={false}>
            <DialogHeader className="flex-row items-start justify-between gap-4 text-left">
              <div className="min-w-0">
                <DialogTitle className="text-[22px] font-bold leading-7">{copy.title}</DialogTitle>
                <DialogDescription className="mt-0.5 text-[13px]">{copy.description}</DialogDescription>
              </div>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(false)}>{copy.close}</Button>
            </DialogHeader>

            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="bg-primary/15 text-primary">{copy.adaptive}</Badge>
              <span className="truncate sm:whitespace-normal">{copy.adaptiveDetail}</span>
            </div>

            <Tabs value={builderTab} onValueChange={(value) => { setSavedConfirmation(false); setBuilderTab(value); }} className="min-h-0 flex-1 gap-0">
              <TabsList variant="line" className="h-8 w-fit border-b border-border p-0">
                <TabsTrigger value="presets" className="px-3">{copy.tabPresets}</TabsTrigger>
                <TabsTrigger value="custom" className="px-3">{copy.tabCustom}</TabsTrigger>
              </TabsList>

              <TabsContent value="presets" className="min-h-0 overflow-hidden">
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto pt-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-[15px] font-semibold">{language === "vi" ? "Bắt đầu bằng một mẫu sẵn sàng ra quyết định" : "Start with a decision-ready pattern"}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{language === "vi" ? "Sáu mẫu dùng trục, định dạng và chỉ số phù hợp bộ KPI." : "Six presets use valid axes, formats and pack-aware metrics."}</p>
                      </div>
                      <Badge variant="secondary">6 presets</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {CHART_PRESETS.map((preset) => {
                        const presentation = PRESET_PRESENTATION[preset.id];
                        return (
                          <div key={preset.id} className="flex min-h-[116px] flex-col rounded-3xl bg-secondary/75 p-4 shadow-sm">
                            <div className="text-sm font-semibold">{presentation?.name || preset.nameEn}</div>
                            <p className="mt-1 max-w-[190px] text-xs leading-4 text-muted-foreground">{presentation?.description || preset.usageEn}</p>
                            <Button className="mt-auto self-end" variant="outline" size="sm" onClick={() => handleAddPreset(preset.id)}>{copy.presetAdd}</Button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 rounded-3xl bg-secondary p-4 shadow-sm">
                      <h3 className="text-sm font-semibold">Pack-aware metric contract</h3>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">Sales: purchases, CPA, ROAS · Lead: leads, CPL · Messages: cost/message, reply quality · Traffic: clicks, CTR, CPC · Awareness: reach, CPM, frequency.</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Unavailable values render as — with an explanation; custom charts never change the KPI pack.</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <span className="text-xs text-muted-foreground">{language === "vi" ? "Có thể chỉnh mẫu sau khi thêm." : "Presets can be edited after they are added."}</span>
                    <Button onClick={() => setBuilderTab("custom")}>{language === "vi" ? "Tự tạo" : "Build custom"}</Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="custom" className="min-h-0 overflow-hidden">
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto pt-3">
                    <div className="flex flex-col gap-3">
                      {savedConfirmation ? (
                        <div className="flex items-start gap-2 rounded-2xl bg-success/10 p-3 text-sm">
                          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
                          <div><div className="font-semibold text-success">{language === "vi" ? "Đã lưu" : "Saved"}</div><div className="text-xs text-muted-foreground">{draft.title} {language === "vi" ? "đã được thêm vào báo cáo." : "is now part of this report."}</div></div>
                        </div>
                      ) : null}

                      <Input
                        aria-label={language === "vi" ? "Tiêu đề biểu đồ" : "Chart title"}
                        value={draft.title}
                        placeholder={copy.titlePlaceholder}
                        onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
                      />

                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{copy.typeLabel}</div>
                        <div className="flex flex-wrap gap-2">
                          {CHART_TYPES.map((type) => (
                            <Button key={type} type="button" size="sm" className="h-8" variant={draft.type === type ? "default" : "outline"} onClick={() => updateDraft((current) => ({ ...current, type }))}>{copy.types[type]}</Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
                          <span className="font-semibold uppercase tracking-[0.05em]">{copy.metricLabel}</span>
                          <span>{draft.series.length} of {MAX_SERIES} selected</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {catalog.map((entry) => {
                            const selected = addedKeys.has(entry.key);
                            const disabled = !selected && atLimit;
                            return (
                              <Button
                                key={entry.key}
                                type="button"
                                variant={selected ? "default" : "secondary"}
                                size="xs"
                                className="h-5 min-w-0 rounded-full px-1.5 text-xs"
                                disabled={disabled}
                                aria-pressed={selected}
                                draggable={!disabled}
                                onDragStart={(event) => {
                                  setDragKey(entry.key);
                                  event.dataTransfer.effectAllowed = "copy";
                                  event.dataTransfer.setData("text/plain", entry.key);
                                }}
                                onDragEnd={() => { setDragKey(null); setDropAxis(null); }}
                                onClick={() => handleMetricClick(entry.key)}
                              >
                                {entry.label === "Cost/msg" ? "Cost / message" : entry.label === "CPA purchase" ? "CPA" : entry.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        {axisCard("left")}
                        {axisCard("right")}
                      </div>

                      {compositionIssues.length ? (
                        <>
                          <div className="flex items-center gap-2 text-xs"><Badge variant="destructive">{language === "vi" ? `Sửa ${compositionIssues.length} lỗi` : `Fix ${compositionIssues.length} issue${compositionIssues.length === 1 ? "" : "s"}`}</Badge><span className="text-muted-foreground">{language === "vi" ? "Giải quyết xung đột trục trước khi lưu." : "Resolve axis conflicts before saving."}</span></div>
                          <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3">
                            <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangleIcon className="size-4 text-warning" />{language === "vi" ? "Biểu đồ cần chỉnh" : "Chart needs attention"}</div>
                            <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">{compositionIssues.map((issue) => <li key={issue.code}>• {issue.message}</li>)}</ul>
                            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => updateDraft(autoFixAxes)}>{language === "vi" ? "Tự sửa trục" : "Auto-fix axes"}</Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant={draft.series.length === 0 ? "secondary" : atLimit ? "outline" : "success"} className={atLimit ? "border-warning/40 text-warning" : undefined}>{draft.series.length === 0 ? copy.needsMetrics : atLimit ? copy.limit : copy.valid}</Badge>
                          <span className="text-muted-foreground">{draft.series.length === 0 ? copy.needsMetricsDetail : atLimit ? copy.limitDetail : !hasTitle ? (language === "vi" ? "Thêm tiêu đề trước khi lưu." : "Add a chart title before saving.") : copy.validDetail}</span>
                        </div>
                      )}

                      {!compositionIssues.length ? draft.series.length === 0 ? (
                        <div className="flex min-h-[164px] flex-col items-center justify-center rounded-2xl border border-border bg-secondary/70 p-5 text-center">
                          <div className="text-sm font-semibold">{copy.previewEmpty}</div>
                          <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{copy.previewEmptyDetail}</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-border bg-secondary/70 p-3">
                          <div className="text-[13px] font-semibold">{draft.title || (language === "vi" ? "Biểu đồ chưa có tiêu đề" : "Untitled chart")}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{previewDescription(draft, language)}</div>
                          <div className="mt-2"><CustomChartPreview spec={draft} rows={report.dailyRows} language={language} currency={currency} /></div>
                        </div>
                      ) : null}

                      {savedConfirmation && unavailableSeries ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3">
                          <Badge variant="outline" className="border-warning/40 text-warning">{language === "vi" ? "Chuỗi không có dữ liệu" : "Series unavailable"}</Badge>
                          <p className="text-xs leading-5 text-muted-foreground">{metricLabel(unavailableSeries.key, language)} {language === "vi" ? "không có dòng hợp lệ trong phạm vi này. Biểu đồ vẫn được lưu và hiển thị — cho chuỗi đó." : "has no valid rows for this scope. The chart stays saved and renders — for that series."}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-3">
                    <span className="text-xs text-muted-foreground">{savedConfirmation ? (language === "vi" ? "Biểu đồ đã lưu vẫn tồn tại khi đổi bộ KPI; chuỗi thiếu luôn được ghi rõ." : "Saved charts persist across pack changes; unavailable series remain explicit.") : compositionIssues.length ? (language === "vi" ? "Không thể lưu đến khi validation hợp lệ." : "Save remains disabled until validation passes.") : atLimit ? (language === "vi" ? "Giới hạn giúp bảo vệ độ dễ đọc và file export." : "Limit protects readability and export integrity.") : canSave ? `${language === "vi" ? "Sẵn sàng lưu" : "Ready to save"} · ${draft.series.length} metrics · ${draft.dualAxis ? "dual axis" : "single axis"}` : (language === "vi" ? "Chọn ít nhất một chỉ số và thêm tiêu đề." : "Select at least one metric and add a title to save.")}</span>
                    <Button type="button" onClick={savedConfirmation ? () => setOpen(false) : handleSaveDraft} disabled={!savedConfirmation && !canSave}>{savedConfirmation ? copy.done : copy.save}</Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {saved.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2" data-print-flow>
          {saved.map((spec) => (
            <div key={spec.id} className="relative">
              <Button variant="ghost" size="icon-sm" aria-label={copy.remove} className="absolute top-3 right-3 z-10" data-print-hidden onClick={() => handleRemoveSaved(spec.id)}>
                <Trash2Icon />
              </Button>
              <CustomChartCard spec={spec} rows={report.dailyRows} language={language} currency={currency} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
