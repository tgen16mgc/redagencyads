"use client";

import * as React from "react";
import { InfoIcon, PlusIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import type { DashboardReport } from "@/lib/types";
import type { InterfaceLanguage } from "@/lib/types";
import { type ChartKey } from "@/lib/chart-spec";
import {
  type CustomAxis,
  type CustomChartSpec,
  type CustomChartType,
  CHART_PRESETS,
  CUSTOM_CHARTS_STORAGE_KEY,
  LEGACY_CUSTOM_CHARTS_STORAGE_KEY,
  addSeries,
  canAddSeries,
  deserializeCharts,
  getMetricCatalog,
  metricFormat,
  metricLabel,
  presetToSpec,
  removeSeries,
  serializeCharts,
  setSeriesAxis,
  validateSpec,
} from "@/lib/custom-chart";
import { CustomChartCard } from "@/components/dashboard/custom-chart-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Copy = {
  trigger: string;
  title: string;
  description: string;
  tabPresets: string;
  tabCustom: string;
  presetAdd: string;
  presetUsage: string;
  presetMeaning: string;
  titleLabel: string;
  titlePlaceholder: string;
  typeLabel: string;
  metricsLabel: string;
  metricsHelp: string;
  seriesLabel: string;
  seriesEmpty: string;
  axisLeft: string;
  axisRight: string;
  remove: string;
  save: string;
  savedLabel: string;
  savedEmpty: string;
  maxReached: string;
  dragHint: string;
  dropLeft: string;
  dropRight: string;
  types: Record<CustomChartType, string>;
};

const COPY: Record<InterfaceLanguage, Copy> = {
  en: {
    trigger: "Build custom chart",
    title: "Custom chart builder",
    description: "Compose a chart from metrics already pulled into this report.",
    tabPresets: "Presets",
    tabCustom: "Custom",
    presetAdd: "Add chart",
    presetUsage: "When to use",
    presetMeaning: "What it means",
    titleLabel: "Chart title",
    titlePlaceholder: "Auto from metrics if left blank",
    typeLabel: "Chart type",
    metricsLabel: "Metrics",
    metricsHelp: "Click a metric to add it. Up to 5 metrics, two formats.",
    seriesLabel: "Series",
    seriesEmpty: "No metrics added yet.",
    axisLeft: "Left",
    axisRight: "Right",
    remove: "Remove",
    save: "Save chart",
    savedLabel: "Saved charts",
    savedEmpty: "No custom charts saved yet.",
    maxReached: "Metric limit reached.",
    dragHint: "Drag a metric onto an axis, or click to add.",
    dropLeft: "Drop to add on left axis",
    dropRight: "Drop to add on right axis",
    types: { line: "Line", bar: "Bar", area: "Area", composed: "Composed" },
  },
  vi: {
    trigger: "Tạo biểu đồ riêng",
    title: "Trình tạo biểu đồ",
    description: "Tạo biểu đồ từ các chỉ số đã kéo về trong báo cáo này.",
    tabPresets: "Mẫu sẵn",
    tabCustom: "Tùy chỉnh",
    presetAdd: "Thêm biểu đồ",
    presetUsage: "Khi nào dùng",
    presetMeaning: "Ý nghĩa",
    titleLabel: "Tiêu đề biểu đồ",
    titlePlaceholder: "Tự đặt theo chỉ số nếu để trống",
    typeLabel: "Loại biểu đồ",
    metricsLabel: "Chỉ số",
    metricsHelp: "Bấm một chỉ số để thêm. Tối đa 5 chỉ số, hai định dạng.",
    seriesLabel: "Chuỗi dữ liệu",
    seriesEmpty: "Chưa thêm chỉ số nào.",
    axisLeft: "Trái",
    axisRight: "Phải",
    remove: "Xóa",
    save: "Lưu biểu đồ",
    savedLabel: "Biểu đồ đã lưu",
    savedEmpty: "Chưa lưu biểu đồ tùy chỉnh nào.",
    maxReached: "Đã đạt giới hạn chỉ số.",
    dragHint: "Kéo một chỉ số vào trục, hoặc bấm để thêm.",
    dropLeft: "Thả để thêm vào trục trái",
    dropRight: "Thả để thêm vào trục phải",
    types: { line: "Đường", bar: "Cột", area: "Vùng", composed: "Kết hợp" },
  },
};

const CHART_TYPES: CustomChartType[] = ["composed", "line", "bar", "area"];

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `chart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDraft(): CustomChartSpec {
  return { id: "draft", title: "", type: "composed", xKey: "date", series: [], dualAxis: false };
}

export function CustomChartsSection({
  report,
  language,
}: {
  report: DashboardReport;
  language: InterfaceLanguage;
}) {
  const copy = COPY[language];
  const currency = report.account.currency || "VND";
  const catalog = getMetricCatalog(language);

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<CustomChartSpec>(emptyDraft);
  const [dragKey, setDragKey] = React.useState<ChartKey | null>(null);
  const [dropAxis, setDropAxis] = React.useState<CustomAxis | null>(null);
  const [saved, setSaved] = React.useState<CustomChartSpec[]>(() => {
    if (typeof window === "undefined") return [];
    const currentValue = window.localStorage.getItem(CUSTOM_CHARTS_STORAGE_KEY);
    const legacyValue = currentValue === null
      ? window.localStorage.getItem(LEGACY_CUSTOM_CHARTS_STORAGE_KEY)
      : null;
    if (legacyValue !== null) {
      window.localStorage.setItem(CUSTOM_CHARTS_STORAGE_KEY, legacyValue);
      window.localStorage.removeItem(LEGACY_CUSTOM_CHARTS_STORAGE_KEY);
    }
    return deserializeCharts(currentValue ?? legacyValue);
  });

  React.useEffect(() => {
    window.localStorage.setItem(CUSTOM_CHARTS_STORAGE_KEY, serializeCharts(saved));
  }, [saved]);

  const draftValidation = validateSpec(draft);
  const addedKeys = new Set(draft.series.map((s) => s.key));

  function handleAddPreset(presetId: string) {
    const preset = CHART_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSaved((prev) => [...prev, presetToSpec(preset, language, newId())]);
  }

  function handleAddMetric(key: ChartKey) {
    setDraft((prev) => addSeries(prev, key));
  }

  function handleRemoveMetric(key: ChartKey) {
    setDraft((prev) => removeSeries(prev, key));
  }

  function handleSetAxis(key: ChartKey, axis: CustomAxis) {
    setDraft((prev) => setSeriesAxis(prev, key, axis));
  }

  function handleDropOnAxis(axis: CustomAxis) {
    const key = dragKey;
    setDragKey(null);
    setDropAxis(null);
    if (!key) return;
    setDraft((prev) => (canAddSeries(prev) && !prev.series.some((s) => s.key === key) ? addSeries(prev, key, axis) : prev));
  }

  function handleSaveDraft() {
    if (!draftValidation.ok) return;
    setSaved((prev) => [...prev, { ...draft, id: newId() }]);
    setDraft(emptyDraft());
  }

  function handleRemoveSaved(id: string) {
    setSaved((prev) => prev.filter((spec) => spec.id !== id));
  }

  return (
    <section className="flex flex-col gap-4" data-print-flow>
      <div className="flex items-center justify-between gap-3" data-print-hidden>
        <div>
          <h3 className="font-heading text-sm font-medium text-foreground">{copy.savedLabel}</h3>
          {saved.length === 0 ? <p className="text-xs text-muted-foreground">{copy.savedEmpty}</p> : null}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm">
                <SlidersHorizontalIcon />
                {copy.trigger}
              </Button>
            }
          />
          <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{copy.title}</SheetTitle>
              <SheetDescription>{copy.description}</SheetDescription>
            </SheetHeader>
            <Separator />
            <Tabs defaultValue="presets" className="gap-3 p-4">
              <TabsList className="w-full">
                <TabsTrigger value="presets">{copy.tabPresets}</TabsTrigger>
                <TabsTrigger value="custom">{copy.tabCustom}</TabsTrigger>
              </TabsList>

              <TabsContent value="presets" className="flex flex-col gap-3">
                {CHART_PRESETS.map((preset) => {
                  const name = language === "vi" ? preset.nameVi : preset.nameEn;
                  const usage = language === "vi" ? preset.usageVi : preset.usageEn;
                  const meaning = language === "vi" ? preset.meaningVi : preset.meaningEn;
                  return (
                    <div key={preset.id} className="flex flex-col gap-2 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{name}</span>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button type="button" aria-label={copy.presetMeaning} className="text-muted-foreground hover:text-foreground">
                                  <InfoIcon className="size-3.5" />
                                </button>
                              }
                            />
                            <TooltipContent>
                              <span className="font-medium">{copy.presetMeaning}: </span>
                              {meaning}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleAddPreset(preset.id)}>
                          <PlusIcon />
                          {copy.presetAdd}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">{copy.presetUsage}: </span>
                        {usage}
                      </p>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="custom" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="custom-chart-title">{copy.titleLabel}</Label>
                  <Input
                    id="custom-chart-title"
                    value={draft.title}
                    placeholder={copy.titlePlaceholder}
                    onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{copy.typeLabel}</Label>
                  <ToggleGroup
                    aria-label={copy.typeLabel}
                    value={[draft.type]}
                    onValueChange={(values) => {
                      const next = values.find((value): value is CustomChartType => CHART_TYPES.includes(value as CustomChartType));
                      if (next) setDraft((prev) => ({ ...prev, type: next }));
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                  >
                    {CHART_TYPES.map((type) => (
                      <ToggleGroupItem key={type} value={type}>
                        {copy.types[type]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>{copy.metricsLabel}</Label>
                  <p className="text-xs text-muted-foreground">{copy.dragHint}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.map((entry) => {
                      const disabled = addedKeys.has(entry.key) || !canAddSeries(draft);
                      return (
                        <Button
                          key={entry.key}
                          variant="outline"
                          size="sm"
                          disabled={disabled}
                          draggable={!disabled}
                          onDragStart={(event) => {
                            setDragKey(entry.key);
                            event.dataTransfer.effectAllowed = "copy";
                            event.dataTransfer.setData("text/plain", entry.key);
                          }}
                          onDragEnd={() => {
                            setDragKey(null);
                            setDropAxis(null);
                          }}
                          onClick={() => handleAddMetric(entry.key)}
                        >
                          <PlusIcon />
                          {entry.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {dragKey ? (
                  <div className="grid grid-cols-2 gap-2" aria-hidden>
                    {(["left", "right"] as const).map((axis) => (
                      <div
                        key={axis}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "copy";
                          setDropAxis(axis);
                        }}
                        onDragLeave={() => setDropAxis((prev) => (prev === axis ? null : prev))}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDropOnAxis(axis);
                        }}
                        className={`flex h-16 items-center justify-center rounded-lg border border-dashed px-2 text-center text-xs transition-colors ${
                          dropAxis === axis
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {axis === "left" ? copy.dropLeft : copy.dropRight}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Label>{copy.seriesLabel}</Label>
                  {draft.series.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{copy.seriesEmpty}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {draft.series.map((s) => (
                        <div key={s.key} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5">
                          <span className="text-sm">{metricLabel(s.key, language)}</span>
                          <div className="flex items-center gap-1.5">
                            <ToggleGroup
                              aria-label={`${metricLabel(s.key, language)} axis`}
                              value={[s.axis]}
                              onValueChange={(values) => {
                                const next = values.find((value): value is CustomAxis => value === "left" || value === "right");
                                if (next) handleSetAxis(s.key, next);
                              }}
                              variant="outline"
                              size="sm"
                              spacing={0}
                            >
                              <ToggleGroupItem value="left">{copy.axisLeft}</ToggleGroupItem>
                              <ToggleGroupItem value="right">{copy.axisRight}</ToggleGroupItem>
                            </ToggleGroup>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={copy.remove}
                              onClick={() => handleRemoveMetric(s.key)}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!draftValidation.ok && draft.series.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {draftValidation.issues.map((issue) => (
                      <li key={issue.code} className="text-xs text-destructive">
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Button onClick={handleSaveDraft} disabled={!draftValidation.ok}>
                  {copy.save}
                </Button>
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
      </div>

      {saved.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2" data-print-flow>
          {saved.map((spec) => (
            <div key={spec.id} className="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.remove}
                className="absolute top-3 right-3 z-10"
                data-print-hidden
                onClick={() => handleRemoveSaved(spec.id)}
              >
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
