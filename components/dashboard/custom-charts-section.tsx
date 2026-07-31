"use client";

import * as React from "react";
import { toast } from "sonner";
import { PlusIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import type { DashboardReport } from "@/lib/types";
import type { InterfaceLanguage } from "@/lib/types";
import { type ChartKey } from "@/lib/chart-spec";
import {
  type CustomAxis,
  type CustomChartSpec,
  type CustomChartType,
  CHART_PRESETS,
  addSeries,
  canAddSeries,
  getMetricCatalog,
  metricFormat,
  metricLabel,
  presetToSpec,
  removeSeries,
  setSeriesAxis,
  validateSpec,
} from "@/lib/custom-chart";
import { CustomChartCard } from "@/components/dashboard/custom-chart-card";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
    title: "Build a custom chart",
    description: "Compose evidence without changing the active KPI pack.",
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
  const catalog = getMetricCatalog(language);

  const [open, setOpen] = React.useState(false);
  const [builderTab, setBuilderTab] = React.useState("presets");
  const [draft, setDraft] = React.useState<CustomChartSpec>(emptyDraft);
  const [dragKey, setDragKey] = React.useState<ChartKey | null>(null);
  const [dropAxis, setDropAxis] = React.useState<CustomAxis | null>(null);
  const draftValidation = validateSpec(draft);
  const addedKeys = new Set(draft.series.map((s) => s.key));

  React.useEffect(() => {
    const openBuilder = () => {
      setBuilderTab("presets");
      setOpen(true);
    };
    window.addEventListener("v2:open-custom-chart", openBuilder);
    return () => window.removeEventListener("v2:open-custom-chart", openBuilder);
  }, []);

  function handleAddPreset(presetId: string) {
    const preset = CHART_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onSavedChange((prev) => [...prev, presetToSpec(preset, language, newId())]);
    toast.success(language === "vi" ? "Đã thêm biểu đồ" : "Chart added", { description: PRESET_PRESENTATION[preset.id]?.name || preset.nameEn });
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
    onSavedChange((prev) => [...prev, { ...draft, id: newId() }]);
    toast.success(language === "vi" ? "Đã lưu biểu đồ tùy chỉnh" : "Custom chart saved", { description: draft.title || draft.series.map((series) => metricLabel(series.key, language)).join(" + ") });
    setDraft(emptyDraft());
  }

  function handleRemoveSaved(id: string) {
    onSavedChange((prev) => prev.filter((spec) => spec.id !== id));
    toast.success(language === "vi" ? "Đã xóa biểu đồ" : "Chart removed");
  }

  return (
    <section className="flex flex-col gap-4" data-print-flow>
      <div className={controllerOnly ? "hidden" : "flex items-center justify-between gap-3"} data-print-hidden>
        <div>
          <h3 className="font-heading text-sm font-medium text-foreground">{copy.savedLabel}</h3>
          {saved.length === 0 ? <p className="text-xs text-muted-foreground">{copy.savedEmpty}</p> : null}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <SlidersHorizontalIcon />
                {copy.trigger}
              </Button>
            }
          />
          <DialogContent className="flex max-h-[calc(100svh-2rem)] max-w-[620px] flex-col overflow-hidden rounded-2xl border border-border bg-popover p-0" showCloseButton={false}>
            <DialogHeader className="flex-row items-start justify-between gap-4 p-4 pb-2">
              <div>
                <DialogTitle className="text-2xl font-semibold">{copy.title}</DialogTitle>
                <DialogDescription className="mt-1">{copy.description}</DialogDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
            </DialogHeader>
            <div className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground"><Badge variant="secondary" className="text-primary">Adaptive metrics</Badge><span>Availability follows the selected pack; missing values stay unavailable.</span></div>
            <Tabs value={builderTab} onValueChange={setBuilderTab} className="min-h-0 flex-1 gap-0">
              <TabsList variant="line" className="mx-4 h-auto w-fit rounded-none p-0">
                <TabsTrigger value="presets">{copy.tabPresets}</TabsTrigger>
                <TabsTrigger value="custom">{copy.tabCustom}</TabsTrigger>
              </TabsList>

              <TabsContent value="presets" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-semibold">Start with a decision-ready pattern.</h3><p className="mt-0.5 text-xs text-muted-foreground">Six presets use valid axes, formats and pack-aware metrics.</p></div>
                  <Badge variant="secondary">6 presets</Badge>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {CHART_PRESETS.map((preset) => {
                    const presentation = PRESET_PRESENTATION[preset.id];
                    return (
                      <div key={preset.id} className="flex min-h-28 flex-col rounded-3xl bg-secondary/70 p-4">
                        <div className="font-semibold">{presentation?.name || preset.nameEn}</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{presentation?.description || preset.usageEn}</p>
                        <Button className="mt-auto self-end" variant="outline" size="sm" onClick={() => handleAddPreset(preset.id)}>{copy.presetAdd}</Button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-3xl bg-secondary p-4"><h3 className="font-semibold">Pack-aware metric contract</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Sales: purchases, CPA, ROAS · Lead: leads, CPL · Messages: cost/message, reply quality · Traffic: clicks, CTR, CPC · Awareness: reach, CPM, frequency.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Unavailable values render as — with an explanation; custom charts never change the KPI pack.</p></div>
                <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Presets can be edited after they are added.</span><Button onClick={() => setBuilderTab("custom")}>Build custom</Button></div>
              </TabsContent>

              <TabsContent value="custom" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
                <div className="flex flex-col gap-4">
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
