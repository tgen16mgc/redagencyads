"use client";

import * as React from "react";
import { DateField, DateRangePicker, Label, Modal as HeroModal, RangeCalendar } from "@heroui/react";
import { type DateValue, getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  GitCompareArrowsIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import type { HealthScoreSummary } from "@/lib/health-score";
import type { ClientReportPdfFile } from "@/lib/client-report";
import { buildCreativeComparisonVerdict } from "@/lib/creative-comparison";
import type { PerformanceStage } from "@/lib/performance-stages";
import type { CompareMode, DashboardReport, InterfaceLanguage, KpiPack, MetaCampaign, NormalizedRow, Verdict } from "@/lib/types";
import { isPeriodPreset, rangeFromDays } from "@/lib/period-scope";
import { reportCampaignSelectionsEqual, toggleReportCampaignSelection } from "@/lib/report-refresh";
import { cn } from "@/lib/utils";
import { MetaCreativeCover } from "@/components/dashboard/meta-creative-media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

const KPI_OPTIONS: { value: KpiPack | "auto"; label: string; detail: string }[] = [
  { value: "auto", label: "Auto-detect", detail: "Infer the KPI pack from campaign objective and available results." },
  { value: "sales_roas", label: "Sales / ROAS", detail: "Purchases, CPA and ROAS" },
  { value: "lead_gen", label: "Lead generation", detail: "Leads, CPL and lead/message" },
  { value: "messages", label: "Messages", detail: "Messages, cost/message and reply rate" },
  { value: "traffic", label: "Traffic", detail: "Link clicks, CTR and CPC" },
  { value: "awareness", label: "Awareness", detail: "Reach, CPM and frequency" },
];

function localizedKpiOptions(language: InterfaceLanguage) {
  if (language === "en") return KPI_OPTIONS;
  const vietnamese: Record<KpiPack | "auto", { label: string; detail: string }> = {
    auto: { label: "Tự động nhận diện", detail: "Suy ra KPI pack từ mục tiêu campaign và kết quả khả dụng." },
    sales_roas: { label: "Sales / ROAS", detail: "Mua hàng, CPA và ROAS" },
    lead_gen: { label: "Tạo lead", detail: "Lead, CPL và tỷ lệ lead/tin nhắn" },
    messages: { label: "Tin nhắn", detail: "Tin nhắn, chi phí/tin nhắn và tỷ lệ phản hồi" },
    traffic: { label: "Lưu lượng", detail: "Click link, CTR và CPC" },
    awareness: { label: "Nhận diện", detail: "Tiếp cận, CPM và tần suất" },
  };
  return KPI_OPTIONS.map((option) => ({ ...option, ...vietnamese[option.value] }));
}

export function CampaignScopeDialog({ open, onOpenChange, campaigns, selectedIds, currency, language, busy, onApply }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: MetaCampaign[];
  selectedIds: string[];
  currency: string;
  language: InterfaceLanguage;
  busy: boolean;
  onApply: (ids: string[]) => Promise<void>;
}) {
  const isVietnamese = language === "vi";
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<string[]>(selectedIds);
  const wasOpenRef = React.useRef(false);
  const visible = campaigns.filter((campaign) => `${campaign.name} ${campaign.objective || ""}`.toLowerCase().includes(query.toLowerCase()));
  const activeIds = React.useMemo(
    () => campaigns.filter((campaign) => campaignStatus(campaign) === "ACTIVE").map((campaign) => campaign.id),
    [campaigns],
  );
  const effectiveDraft = draft.length ? draft : activeIds;
  const effectiveCurrent = selectedIds.length ? selectedIds : activeIds;
  const selectionUnchanged = reportCampaignSelectionsEqual(effectiveDraft, effectiveCurrent);
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(selectedIds);
      setQuery("");
    }
    wasOpenRef.current = open;
  }, [open, selectedIds]);

  function toggle(id: string) {
    setDraft((current) => toggleReportCampaignSelection({ selectedIds: current, activeCampaignIds: activeIds, campaignId: id }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(620px,calc(100svh-2rem))] max-w-[440px] flex-col rounded-3xl border border-border bg-popover p-0" showCloseButton={false}>
        <DialogHeader className="p-5 pb-2">
          <DialogTitle className="text-xl font-semibold">{isVietnamese ? "Chọn campaign" : "Choose campaigns"}</DialogTitle>
          <DialogDescription className="mt-2 leading-5">{isVietnamese ? "Tạo một phạm vi evidence rõ ràng. Campaign active được chọn mặc định." : "Build a focused evidence set. Active campaigns are selected by default."}</DialogDescription>
        </DialogHeader>
        <div className="relative px-5">
          <SearchIcon className="pointer-events-none absolute left-8 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVietnamese ? "Tìm campaign..." : "Search campaigns..."} className="pl-9" />
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5">
          <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground"><span>{isVietnamese ? "Campaign có sẵn" : "Available campaigns"}</span><button type="button" className="normal-case text-primary" onClick={() => setDraft([])}>{isVietnamese ? "Tất cả active" : "All active"}</button></div>
          <div className="grid gap-1.5">
            {visible.map((campaign) => {
              const selected = draft.length ? draft.includes(campaign.id) : campaignStatus(campaign) === "ACTIVE";
              return (
                <button key={campaign.id} type="button" aria-pressed={selected} onClick={() => toggle(campaign.id)} className={cn("rounded-2xl px-3 py-2.5 text-left transition-colors", selected ? "bg-primary/14 text-foreground" : "text-muted-foreground hover:bg-secondary/60")}>
                  <span className="block text-sm font-medium text-foreground">{campaign.name}</span>
                  <span className="mt-0.5 block text-[11px] uppercase">{campaignStatus(campaign)} · {formatObjective(campaign.objective, language)}{formatBudget(campaign, currency)}</span>
                </button>
              );
            })}
            {!visible.length ? <div className="py-10 text-center text-sm text-muted-foreground">{isVietnamese ? "Không có campaign khớp với tìm kiếm này." : "No campaigns match this search."}</div> : null}
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 border-t border-border p-5">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{isVietnamese ? "Hủy" : "Cancel"}</Button>
          <Button disabled={busy || selectionUnchanged || (!draft.length && !activeIds.length)} onClick={async () => { await onApply(draft); onOpenChange(false); }}>{busy ? <Spinner data-icon="inline-start" /> : null}{selectionUnchanged ? (isVietnamese ? "Phạm vi hiện tại" : "Current scope") : draft.length ? (isVietnamese ? `Áp dụng ${draft.length} campaign` : `Apply ${draft.length} campaign${draft.length === 1 ? "" : "s"}`) : (isVietnamese ? "Áp dụng tất cả active" : "Apply all active")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PeriodScopeDialog({ open, onOpenChange, currentDays, since, until, language, busy, onApply }: { open: boolean; onOpenChange: (open: boolean) => void; currentDays: number; since: string; until: string; language: InterfaceLanguage; busy: boolean; onApply: (range: { since: string; until: string }) => Promise<void> }) {
  const isVietnamese = language === "vi";
  const [days, setDays] = React.useState<number | "custom">(currentDays);
  const [range, setRange] = React.useState<{ start: DateValue; end: DateValue } | null>(null);
  const [rangeError, setRangeError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setDays(isPeriodPreset(currentDays) ? currentDays : "custom");
    setRangeError("");
    setRange(safeRange(since, until));
  }, [open, currentDays, since, until]);

  const options = [
    { days: 7, detail: isVietnamese ? "Tín hiệu nhanh · biến động cao hơn" : "Fast signal · higher volatility" },
    { days: 30, detail: isVietnamese ? "Khuyến nghị · cửa sổ chẩn đoán ổn định" : "Recommended · stable diagnosis window" },
    { days: 90, detail: isVietnamese ? "Bối cảnh xu hướng · phản ứng chậm hơn" : "Trend context · slower to react" },
  ];

  const maxDate = today(getLocalTimeZone());
  const customSelected = days === "custom";
  const appliedRange = customSelected && range ? { since: range.start.toString(), until: range.end.toString() } : null;
  const draftRange = customSelected ? appliedRange : typeof days === "number" && isPeriodPreset(days) ? rangeFromDays(days, until) : null;
  const rangeUnchanged = draftRange?.since === since && draftRange?.until === until;
  const applyDisabled = busy || !draftRange || rangeUnchanged;

  async function apply() {
    if (customSelected) {
      if (!range) {
        setRangeError(isVietnamese ? "Chọn ngày bắt đầu và ngày kết thúc." : "Choose a start and end date.");
        return;
      }
      if (range.end.compare(range.start) < 0) {
        setRangeError(isVietnamese ? "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." : "The end date must be on or after the start date.");
        return;
      }
      if (range.end.compare(maxDate) > 0) {
        setRangeError(isVietnamese ? "Ngày kết thúc không thể ở tương lai." : "The end date cannot be in the future.");
        return;
      }
      await onApply({ since: range.start.toString(), until: range.end.toString() });
    } else {
      await onApply(rangeFromDays(days as number, until));
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] min-w-0 max-w-[440px] overflow-x-hidden rounded-3xl border border-border bg-popover p-0" showCloseButton={false}>
        <DialogHeader className="p-5 pb-3"><DialogTitle className="text-xl font-semibold">{isVietnamese ? "Chọn kỳ báo cáo" : "Choose reporting period"}</DialogTitle><DialogDescription className="mt-2 leading-5">{isVietnamese ? "Dùng một cửa sổ nhất quán cho các so sánh CPC, chi phí outcome và ROAS." : "Use one consistent window across CPC, outcome-cost and ROAS comparisons."}</DialogDescription></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-5">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{isVietnamese ? "Cửa sổ báo cáo" : "Reporting window"}</div>
          {options.map((option) => <button key={option.days} type="button" onClick={() => { setDays(option.days); setRangeError(""); }} className={cn("mb-1 w-full rounded-2xl px-3 py-2.5 text-left", days === option.days ? "bg-primary/14" : "hover:bg-secondary/60")}><span className="block text-sm font-medium">{isVietnamese ? `${option.days} ngày gần nhất` : `Last ${option.days} days`}</span><span className="text-xs text-muted-foreground">{option.detail}</span></button>)}
          <button type="button" onClick={() => { setDays("custom"); setRangeError(""); }} className={cn("mb-1 w-full rounded-2xl px-3 py-2.5 text-left", customSelected ? "bg-primary/14" : "hover:bg-secondary/60")}><span className="block text-sm font-medium">{isVietnamese ? "Khoảng tùy chỉnh" : "Custom range"}</span><span className="text-xs text-muted-foreground">{isVietnamese ? "Chọn chính xác ngày bắt đầu và kết thúc" : "Pick exact start and end dates"}</span></button>
          {customSelected ? (
            <div className="mb-1 rounded-2xl border border-border p-3">
              <DateRangePicker
                value={range}
                onChange={(next) => { setRange(next); setRangeError(""); }}
                maxValue={maxDate}
                aria-label={isVietnamese ? "Khoảng báo cáo tùy chỉnh" : "Custom reporting range"}
              >
                <Label className="text-xs text-muted-foreground">{isVietnamese ? "Ngày bắt đầu và kết thúc" : "Start and end date"}</Label>
                <DateField.Group
                  fullWidth
                  className="[--field-foreground:var(--primary-foreground)] [--field-placeholder:var(--muted-foreground)] [--muted:var(--muted-foreground)]"
                >
                  <DateField.Input slot="start">
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateRangePicker.RangeSeparator />
                  <DateField.Input slot="end">
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DateRangePicker.Trigger>
                      <DateRangePicker.TriggerIndicator />
                    </DateRangePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DateRangePicker.Popover>
                  <RangeCalendar aria-label={isVietnamese ? "Khoảng báo cáo tùy chỉnh" : "Custom reporting range"}>
                    <RangeCalendar.Header>
                      <RangeCalendar.YearPickerTrigger>
                        <RangeCalendar.YearPickerTriggerHeading />
                        <RangeCalendar.YearPickerTriggerIndicator />
                      </RangeCalendar.YearPickerTrigger>
                      <RangeCalendar.NavButton slot="previous" />
                      <RangeCalendar.NavButton slot="next" />
                    </RangeCalendar.Header>
                    <RangeCalendar.Grid>
                      <RangeCalendar.GridHeader>
                        {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                      </RangeCalendar.GridHeader>
                      <RangeCalendar.GridBody>
                        {(date) => <RangeCalendar.Cell date={date} />}
                      </RangeCalendar.GridBody>
                    </RangeCalendar.Grid>
                    <RangeCalendar.YearPickerGrid>
                      <RangeCalendar.YearPickerGridBody>
                        {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                      </RangeCalendar.YearPickerGridBody>
                    </RangeCalendar.YearPickerGrid>
                  </RangeCalendar>
                </DateRangePicker.Popover>
              </DateRangePicker>
              {rangeError ? <p role="alert" className="mt-2 text-xs text-destructive">{rangeError}</p> : null}
            </div>
          ) : null}
        </div>
        <DialogFooter className="mt-5 grid grid-cols-2 border-t border-border p-5"><Button variant="secondary" onClick={() => onOpenChange(false)}>{isVietnamese ? "Hủy" : "Cancel"}</Button><Button disabled={applyDisabled} onClick={apply}>{busy ? <Spinner data-icon="inline-start" /> : null}{rangeUnchanged ? (isVietnamese ? "Kỳ hiện tại" : "Current period") : customSelected ? (isVietnamese ? "Áp dụng khoảng ngày" : "Apply range") : (isVietnamese ? `Áp dụng ${days} ngày` : `Apply ${days} days`)}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function safeRange(since: string, until: string): { start: DateValue; end: DateValue } | null {
  try {
    return { start: parseDate(since), end: parseDate(until) };
  } catch {
    return null;
  }
}


export function KpiPackDialog({ open, onOpenChange, current, language, busy, onApply }: { open: boolean; onOpenChange: (open: boolean) => void; current: KpiPack | "auto"; language: InterfaceLanguage; busy: boolean; onApply: (pack: KpiPack | "auto") => Promise<void> }) {
  const isVietnamese = language === "vi";
  const [draft, setDraft] = React.useState<KpiPack | "auto">(current);
  React.useEffect(() => { if (open) setDraft(current); }, [open, current]);
  const options = localizedKpiOptions(language);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] rounded-3xl border border-border bg-popover p-0" showCloseButton={false}>
        <DialogHeader className="p-5 pb-3"><DialogTitle className="text-xl font-semibold">{isVietnamese ? "Chọn KPI pack" : "Choose KPI pack"}</DialogTitle><DialogDescription className="mt-2 leading-5">{isVietnamese ? "Đổi góc nhìn chỉ số trên mọi tab chẩn đoán mà vẫn giữ nguyên phạm vi campaign và kỳ báo cáo." : "Switch the metric lens across every diagnosis tab while preserving campaign scope and period."}</DialogDescription></DialogHeader>
        <div className="px-5"><div className="mb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{isVietnamese ? "Mục tiêu tối ưu" : "Optimization objective"}</div>{options.map((option) => <button key={option.value} type="button" disabled={busy} onClick={() => setDraft(option.value)} className={cn("mb-1 w-full rounded-2xl px-3 py-2.5 text-left", option.value === draft ? "bg-primary/14" : "hover:bg-secondary/60")}><span className="block text-sm font-medium">{option.label}</span><span className="text-xs text-muted-foreground">{option.detail}</span></button>)}</div>
        <DialogFooter className="mt-4 grid grid-cols-2 border-t border-border p-5"><Button variant="secondary" onClick={() => onOpenChange(false)}>{isVietnamese ? "Hủy" : "Cancel"}</Button><Button disabled={busy || draft === current} onClick={async () => { await onApply(draft); onOpenChange(false); }}>{busy ? <Spinner data-icon="inline-start" /> : null}{draft === current ? (isVietnamese ? "KPI hiện tại" : "Current KPI") : (isVietnamese ? "Áp dụng KPI" : "Apply KPI")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ComparisonDialog({ open, onOpenChange, current, campaignComparisonAvailable, language, busy, onApply }: { open: boolean; onOpenChange: (open: boolean) => void; current: CompareMode; campaignComparisonAvailable: boolean; language: InterfaceLanguage; busy: boolean; onApply: (mode: CompareMode) => Promise<void> }) {
  const isVietnamese = language === "vi";
  const normalizedCurrent: CompareMode = current === "off" || current === "campaign" ? current : "previous";
  const [draft, setDraft] = React.useState<CompareMode>(normalizedCurrent);
  React.useEffect(() => { if (open) setDraft(normalizedCurrent); }, [open, normalizedCurrent]);
  const options: Array<{ value: CompareMode; label: string; detail: string; disabled?: boolean }> = [
    { value: "previous", label: isVietnamese ? "Kỳ trước" : "Previous period", detail: isVietnamese ? "Cùng độ dài, ngay trước kỳ hiện tại" : "Same duration immediately before" },
    { value: "campaign", label: isVietnamese ? "Nhóm campaign" : "Campaign group", detail: isVietnamese ? "Campaign đã chọn so với nhóm đối chứng" : "Selected campaigns versus peer set", disabled: !campaignComparisonAvailable },
    { value: "off", label: isVietnamese ? "Không so sánh" : "No comparison", detail: isVietnamese ? "Chỉ hiển thị chỉ số tuyệt đối" : "Absolute metrics only" },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] min-w-0 max-w-[440px] overflow-x-hidden rounded-3xl border border-border bg-popover p-0" showCloseButton={false}>
        <DialogHeader className="p-5 pb-3"><DialogTitle className="text-xl font-semibold">{isVietnamese ? "Chọn cách so sánh" : "Choose comparison"}</DialogTitle><DialogDescription className="mt-2 leading-5">{isVietnamese ? "Giữ mọi biến động chỉ số gắn với một cơ sở so sánh rõ ràng." : "Keep metric deltas anchored to one explicit comparison basis."}</DialogDescription></DialogHeader>
        <div className="px-5">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{isVietnamese ? "So sánh với" : "Compare against"}</div>
          <div className="grid gap-1.5">
            {options.map((option) => (
              <button key={option.value} type="button" disabled={option.disabled} onClick={() => setDraft(option.value)} className={cn("flex min-h-12 items-center justify-between rounded-2xl px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-45", draft === option.value ? "bg-primary/14" : "hover:bg-secondary/60")}>
                <span><span className="block text-sm font-medium">{option.label}</span><span className="text-xs text-muted-foreground">{option.detail}</span></span>
                <span className={cn("size-4 rounded-full border", draft === option.value ? "border-[5px] border-primary" : "border-border")} />
              </button>
            ))}
          </div>
          {!campaignComparisonAvailable ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{isVietnamese ? "Chọn ít nhất một campaign và giữ một campaign active ngoài phạm vi để bật so sánh theo nhóm." : "Select at least one campaign and keep one active peer outside the scope to enable campaign-group comparison."}</p> : null}
        </div>
        <DialogFooter className="mt-5 grid grid-cols-2 border-t border-border p-5"><Button variant="secondary" onClick={() => onOpenChange(false)}>{isVietnamese ? "Hủy" : "Cancel"}</Button><Button disabled={busy || draft === normalizedCurrent} onClick={async () => { await onApply(draft); onOpenChange(false); }}>{busy ? <Spinner data-icon="inline-start" /> : null}{draft === normalizedCurrent ? (isVietnamese ? "So sánh hiện tại" : "Current comparison") : (isVietnamese ? "Áp dụng so sánh" : "Apply comparison")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ExportState = "idle" | "preparing" | "ready" | "downloading" | "downloaded" | "error";

export function ExportDiagnosisDialog({ open, onOpenChange, report, accountLabel, periodLabel, language, exporting, onPreparePdf }: { open: boolean; onOpenChange: (open: boolean) => void; report: DashboardReport; accountLabel: string; periodLabel: string; language: InterfaceLanguage; exporting: boolean; onPreparePdf: () => Promise<ClientReportPdfFile> }) {
  const isVietnamese = language === "vi";
  const [format, setFormat] = React.useState<"pdf" | "csv">("pdf");
  const [state, setState] = React.useState<ExportState>("idle");
  const [file, setFile] = React.useState<ClientReportPdfFile | null>(null);
  const [error, setError] = React.useState("");
  const [progress, setProgress] = React.useState(18);

  React.useEffect(() => {
    if (!open) return;
    setState("idle");
    setFile(null);
    setError("");
    setProgress(18);
  }, [open]);

  React.useEffect(() => {
    if (state !== "preparing") return;
    const timer = window.setInterval(() => setProgress((value) => Math.min(88, value + Math.max(2, Math.round((92 - value) / 7)))), 240);
    return () => window.clearInterval(timer);
  }, [state]);

  async function prepare() {
    setError("");
    setProgress(18);
    setState("preparing");
    try {
      const nextFile = format === "pdf" ? await onPreparePdf() : buildReportCsv(report);
      setFile(nextFile);
      setProgress(100);
      setState("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (isVietnamese ? "Không thể chuẩn bị file xuất." : "Could not prepare this export."));
      setState("error");
    }
  }

  function download() {
    if (!file) return;
    setState("downloading");
    const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    window.requestAnimationFrame(() => setState("downloaded"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-3xl border border-border bg-popover p-6">
        {state === "idle" ? (
          <>
            <DialogHeader><DialogTitle>{isVietnamese ? "Xuất chẩn đoán" : "Export diagnosis"}</DialogTitle><DialogDescription className="mt-1 leading-5">{isVietnamese ? "Đóng gói chẩn đoán hiện tại để khách hàng rà soát mà không đổi phạm vi campaign." : "Package the current diagnosis for client review without changing campaign scope."}</DialogDescription></DialogHeader>
            <div className="mt-4 grid gap-4">
              <div><div className="mb-2 text-xs font-medium">{isVietnamese ? "Định dạng file" : "File format"}</div><div className="flex gap-2"><Button size="sm" variant={format === "pdf" ? "default" : "outline"} onClick={() => setFormat("pdf")}>{isVietnamese ? "Báo cáo PDF" : "PDF report"}</Button><Button size="sm" variant={format === "csv" ? "default" : "outline"} onClick={() => setFormat("csv")}>{isVietnamese ? "Chỉ số CSV" : "CSV metrics"}</Button></div></div>
              <div><div className="mb-2 text-xs font-medium">{isVietnamese ? "Các phần được bao gồm" : "Included sections"}</div><div className="grid gap-2 text-sm">{(isVietnamese ? ["Chẩn đoán điều hành và hành động ưu tiên", "Chỉ số funnel theo KPI pack hiện tại", "Ghi chú evidence và nhãn độ tin cậy"] : ["Executive diagnosis and priority actions", "Funnel metrics for the active KPI pack", "Evidence notes and confidence labels"]).map((label) => <label key={label} className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked readOnly className="accent-[var(--primary)]" />{label}</label>)}</div></div>
              <div className="rounded-xl bg-secondary/55 p-3 text-xs text-muted-foreground"><Badge variant="secondary" className="mr-2">{isVietnamese ? "Phạm vi hiện tại" : "Current scope"}</Badge>{accountLabel} · {periodLabel}<div className="mt-2">{isVietnamese ? "Chỉ số không khả dụng vẫn được ghi là Chưa theo dõi hoặc Không đủ dữ liệu." : "Unavailable metrics stay labeled Not tracked or Insufficient data."}</div></div>
            </div>
            <DialogFooter className="mt-5"><Button variant="outline" onClick={() => onOpenChange(false)}>{isVietnamese ? "Hủy" : "Cancel"}</Button><Button disabled={exporting} onClick={() => void prepare()}>{format === "pdf" ? <DownloadIcon data-icon="inline-start" /> : <FileSpreadsheetIcon data-icon="inline-start" />}{isVietnamese ? `Xuất ${format.toUpperCase()}` : `Export ${format.toUpperCase()}`}</Button></DialogFooter>
          </>
        ) : state === "preparing" ? (
          <ExportStatus title={isVietnamese ? `Đang chuẩn bị ${format.toUpperCase()}` : `Preparing ${format.toUpperCase()}`} description={isVietnamese ? "Đang đóng gói chỉ số funnel, ghi chú evidence và nhãn độ tin cậy." : "Packaging funnel metrics, evidence notes and confidence labels."} icon={<Spinner />}>
            <div className="mt-5 rounded-2xl bg-card p-4"><div className="flex items-center justify-between text-xs"><span>{isVietnamese ? "Đang tạo" : "Generating"} · {progress}%</span><span className="text-muted-foreground">{exportFilename(report, format)}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} /></div></div>
            <DialogFooter className="mt-6"><Button variant="outline" onClick={() => onOpenChange(false)}>{isVietnamese ? "Tiếp tục làm việc" : "Keep working"}</Button></DialogFooter>
          </ExportStatus>
        ) : state === "ready" && file ? (
          <ExportStatus title={isVietnamese ? "File xuất đã sẵn sàng" : "Export ready"} description={isVietnamese ? "Chẩn đoán đã được đóng gói cùng chỉ số funnel và ghi chú evidence hiện tại." : "Your diagnosis is packaged with the current funnel metrics and evidence notes."} icon={<CheckCircle2Icon />}>
            <FileReady file={file} label={isVietnamese ? "Sẵn sàng tải xuống" : "Ready to download"} />
            <DialogFooter className="mt-6"><Button onClick={download}><DownloadIcon data-icon="inline-start" />{isVietnamese ? `Tải ${format.toUpperCase()}` : `Download ${format.toUpperCase()}`}</Button></DialogFooter>
          </ExportStatus>
        ) : state === "downloading" || state === "downloaded" ? (
          <ExportStatus title={isVietnamese ? "Đã bắt đầu tải xuống" : "Download started"} description={isVietnamese ? `${format.toUpperCase()} đang được tải với phạm vi đã chọn và nhãn dữ liệu thiếu được giữ nguyên.` : `Your ${format.toUpperCase()} is downloading with the selected scope and missing-data labels preserved.`} icon={<CheckCircle2Icon />}>
            {file ? <FileReady file={file} label={isVietnamese ? "Đang tải xuống" : "Downloading"} /> : null}
            <DialogFooter className="mt-6"><Button onClick={() => onOpenChange(false)}>{isVietnamese ? "Xong" : "Done"}</Button></DialogFooter>
          </ExportStatus>
        ) : (
          <ExportStatus title={isVietnamese ? "Không thể chuẩn bị file xuất" : "Export could not be prepared"} description={error || (isVietnamese ? "Trình tạo báo cáo không trả về file." : "The report generator did not return a file.")} icon={<FileSpreadsheetIcon />}>
            <DialogFooter className="mt-6"><Button variant="outline" onClick={() => setState("idle")}>{isVietnamese ? "Quay lại" : "Back"}</Button><Button onClick={() => void prepare()}>{isVietnamese ? "Thử lại" : "Try again"}</Button></DialogFooter>
          </ExportStatus>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExportStatus({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <><DialogHeader><span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span><DialogTitle>{title}</DialogTitle><DialogDescription className="mt-1 leading-5">{description}</DialogDescription></DialogHeader>{children}</>;
}

function FileReady({ file, label }: { file: ClientReportPdfFile; label: string }) {
  return <div className="mt-5 rounded-2xl bg-card p-4"><div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</div><div className="mt-2 text-sm font-medium">{file.filename}</div><div className="mt-1 text-xs text-muted-foreground">{formatBytes(file.blob.size)}</div></div>;
}

export function ActionPlanModal({ open, onOpenChange, report, verdict, healthSummary, language, loading, onGenerate, onExport }: { open: boolean; onOpenChange: (open: boolean) => void; report: DashboardReport; verdict: Verdict | null; healthSummary: HealthScoreSummary | null; language: InterfaceLanguage; loading: boolean; onGenerate: () => void; onExport: () => void }) {
  const isVietnamese = language === "vi";
  const requestedRef = React.useRef(false);
  const [selectedAction, setSelectedAction] = React.useState<number | null>(null);
  const [reviewedActions, setReviewedActions] = React.useState<Set<number>>(() => new Set());
  React.useEffect(() => {
    requestedRef.current = false;
    setSelectedAction(null);
    setReviewedActions(new Set());
  }, [report.pulledAt, verdict]);
  React.useEffect(() => {
    if (!open) {
      requestedRef.current = false;
      setSelectedAction(null);
      return;
    }
    if (!verdict && !loading && !requestedRef.current) {
      requestedRef.current = true;
      onGenerate();
    }
  }, [open, verdict, loading, onGenerate]);
  const fallback = healthSummary?.items.filter((item) => item.severity !== "healthy").map((item) => item.detail[language]) || [];
  const actions = verdict ? [...verdict.budget_moves, ...verdict.tests].filter(Boolean).slice(0, 3) : fallback.slice(0, 3);
  const decision = verdict?.verdict || defaultDecision(report, language);
  const activeAction = selectedAction === null ? null : actions[selectedAction];
  const activeActionIndex = selectedAction ?? 0;
  const activeTitle = activeAction ? actionTitle(activeAction, activeActionIndex, language) : "";
  return (
    <HeroModal.Backdrop isOpen={open} onOpenChange={onOpenChange} variant="blur">
      <HeroModal.Container size="lg" placement="center" scroll="inside">
        <HeroModal.Dialog className="border border-border bg-popover text-foreground">
        {activeAction ? <>
          <HeroModal.Header className="p-6"><div><Badge className="mb-2 w-fit" variant="secondary">{isVietnamese ? "Evidence hành động" : "Action evidence"}</Badge><HeroModal.Heading className="text-xl font-semibold text-foreground">{activeTitle}</HeroModal.Heading><p className="mt-1 text-sm text-muted-foreground">{isVietnamese ? "Độ tin cậy cao" : "High confidence"} · {actionSignals(report).length} {isVietnamese ? "điểm evidence" : "evidence points"}</p></div><HeroModal.CloseTrigger className="text-muted-foreground hover:text-foreground" /></HeroModal.Header>
          <HeroModal.Body className="grid gap-5 px-6 pb-6">
            <div className="rounded-2xl bg-card p-4"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{activeActionIndex === 1 ? (isVietnamese ? "Ngưỡng bảo vệ khi scale" : "Scale guardrail") : (isVietnamese ? "Tác động kỳ vọng" : "Expected impact")}</span><Badge variant="success">{isVietnamese ? "Tin cậy cao" : "High confidence"}</Badge></div><div className="mt-3 text-base font-semibold">{actionImpact(report, activeActionIndex)}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{isVietnamese ? "Đây là ước tính định hướng có ngưỡng bảo vệ dựa trên phạm vi đã chọn, không phải kết quả được đảm bảo." : "This is a guarded directional estimate based on the selected scope, not a guaranteed outcome."}</p></div>
            <div><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{activeActionIndex === 1 ? (isVietnamese ? "Tín hiệu cần theo dõi" : "Signals to monitor") : (isVietnamese ? "Evidence đính kèm" : "Evidence attached")}</h3><Badge>{actionSignals(report).length} {isVietnamese ? "điểm" : "points"}</Badge></div>{actionSignals(report).map((signal) => <div key={signal.title} className="rounded-xl px-3 py-2.5"><div className="text-sm font-medium">{signal.title}</div><div className="mt-0.5 text-xs text-muted-foreground">{signal.detail}</div></div>)}</div>
            <AccordionList items={[
              [isVietnamese ? "Entity bị ảnh hưởng" : "Affected entities", report.adsetRows.slice(0, 3).map((row) => row.name).join(", ") || (isVietnamese ? "Phạm vi báo cáo hiện tại." : "Current report scope.")],
              [isVietnamese ? "Ngưỡng bảo vệ" : "Guardrail", actionGuardrail(report)],
              [isVietnamese ? "Độ tin cậy" : "Confidence", isVietnamese ? `Khuyến nghị dùng ${report.campaignRows.length} hàng campaign, ${report.adsetRows.length} hàng ad set và ${report.adRows.length} hàng ad.` : `The recommendation uses ${report.campaignRows.length} campaign rows, ${report.adsetRows.length} ad-set rows and ${report.adRows.length} ad rows.`],
              [isVietnamese ? "Giả định" : "Assumptions", verdict?.assumptions.join(" ") || report.packReason],
              [isVietnamese ? "Thử nghiệm đề xuất" : "Recommended test", activeAction],
              [isVietnamese ? "Thước đo thành công" : "Success measure", actionSuccessMeasure(report)],
            ]} />
          </HeroModal.Body>
          <HeroModal.Footer className="flex-row justify-end border-t border-border bg-popover p-6"><Button variant="outline" onClick={() => setSelectedAction(null)}>{isVietnamese ? "Quay lại kế hoạch" : "Back to plan"}</Button><Button onClick={() => { setReviewedActions((current) => new Set(current).add(activeActionIndex)); toast.success(isVietnamese ? "Đã đánh dấu hành động" : "Action marked reviewed", { description: activeTitle }); setSelectedAction(null); }}><CheckCircle2Icon data-icon="inline-start" />{isVietnamese ? "Đánh dấu đã xem" : "Mark reviewed"}</Button></HeroModal.Footer>
        </> : <>
          <HeroModal.Header className="p-6"><div><Badge className="mb-2 w-fit" variant="secondary">{packLabel(report.selectedPack, language)} {isVietnamese ? "· kế hoạch" : "plan"}</Badge><HeroModal.Heading className="text-xl font-semibold text-foreground">{isVietnamese ? "Rà soát hành động đề xuất" : "Review recommended actions"}</HeroModal.Heading><p className="mt-1 text-sm text-muted-foreground">{packLabel(report.selectedPack, language)} · {actions.length} {isVietnamese ? "sẵn sàng · có evidence" : "ready · evidence-backed"}</p></div><HeroModal.CloseTrigger className="text-muted-foreground hover:text-foreground" /></HeroModal.Header>
          <HeroModal.Body className="grid gap-5 px-6 pb-6">
            <div className="rounded-2xl bg-card p-4 text-foreground"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{isVietnamese ? "Quyết định chính" : "Primary decision"}</span><Badge variant="success">{isVietnamese ? "Tin cậy cao" : "High confidence"}</Badge></div><div className="mt-3 text-base font-semibold text-foreground">{decision}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{isVietnamese ? "Kế hoạch tuân theo KPI pack, phạm vi, cách so sánh và evidence hiện tại." : "The plan follows the active KPI pack, scope, comparison and evidence."}</p></div>
            <div>
              <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-foreground">{isVietnamese ? "Hàng đợi hành động" : "Action queue"}</h3><Badge>{actions.length} {isVietnamese ? "sẵn sàng" : "ready"}</Badge></div>
              {loading ? <div className="flex items-center gap-2 rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground"><Spinner />{isVietnamese ? "Đang tạo kế hoạch có evidence..." : "Generating the evidence-backed plan..."}</div> : actions.length ? <>
                {!verdict && requestedRef.current ? <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 p-3"><p className="text-xs text-muted-foreground">{isVietnamese ? "Đang dùng chẩn đoán dự phòng vì chưa nhận được kế hoạch AI." : "Using diagnostic fallback actions because the AI plan was not returned."}</p><Button type="button" size="sm" variant="outline" onClick={() => { requestedRef.current = true; onGenerate(); }}><SparklesIcon data-icon="inline-start" />{isVietnamese ? "Thử tạo lại" : "Retry generation"}</Button></div> : null}
                {actions.map((action, index) => <button key={`${action}-${index}`} type="button" className="group flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left text-foreground hover:bg-secondary/60" onClick={() => setSelectedAction(index)}><span><span className="flex items-center gap-2 text-sm font-medium text-foreground">{actionTitle(action, index, language)}{reviewedActions.has(index) ? <Badge variant="success">{isVietnamese ? "Đã xem" : "Reviewed"}</Badge> : null}</span><span className="mt-0.5 block text-xs text-muted-foreground">{action}</span></span><ArrowRightIcon className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></button>)}
              </> : <div className="rounded-xl bg-secondary/40 p-4"><p className="text-sm text-muted-foreground">{isVietnamese ? "Chưa có hành động nổi trội. Có thể thử tạo lại ngay trong cửa sổ này." : "No dominant action is ready yet. You can retry without closing this dialog."}</p><Button type="button" size="sm" className="mt-3" onClick={() => { requestedRef.current = true; onGenerate(); }}><SparklesIcon data-icon="inline-start" />{isVietnamese ? "Tạo lại kế hoạch" : "Retry generation"}</Button></div>}
            </div>
            <AccordionList items={[
              [isVietnamese ? "Điều chỉnh ngân sách" : "Budget moves", verdict?.budget_moves.join(" ") || (isVietnamese ? "Giữ lần scale tiếp theo cho đến khi bước yếu nhất phục hồi." : "Hold the next scale move until the weakest stage recovers.")],
              [isVietnamese ? "Rủi ro" : "Risks", healthSummary?.items.filter((item) => item.severity !== "healthy").map((item) => item.detail[language]).join(" ") || (isVietnamese ? "Không có rủi ro nổi trội trong phạm vi hiện tại." : "No dominant risk in the current scope.")],
              [isVietnamese ? "Thử nghiệm" : "Tests", verdict?.tests.join(" ") || (isVietnamese ? "Chạy một thử nghiệm có đối chứng cho điểm nghẽn chính." : "Run one controlled test against the primary constraint.")],
              [isVietnamese ? "Nhóm thắng và thua" : "Winners and losers", verdict ? [...verdict.winners, ...verdict.losers].join(" ") : (isVietnamese ? "Xếp hạng theo hiệu quả outcome chính." : "Rankings follow primary outcome efficiency.")],
              [isVietnamese ? "Giả định" : "Assumptions", verdict?.assumptions.join(" ") || report.packReason],
              [isVietnamese ? "Phương thức xuất" : "Export method", isVietnamese ? "PDF giữ nguyên phạm vi, KPI pack, evidence và kế hoạch hành động hiện tại." : "The PDF preserves the active scope, KPI pack, evidence and action plan."],
            ]} />
          </HeroModal.Body>
          <HeroModal.Footer className="flex-row justify-end border-t border-border bg-popover p-6"><Button variant="outline" onClick={() => onOpenChange(false)}>{isVietnamese ? "Đóng" : "Close"}</Button><Button onClick={onExport}><DownloadIcon data-icon="inline-start" />{isVietnamese ? "Xuất kế hoạch" : "Export plan"}</Button></HeroModal.Footer>
        </>}
        </HeroModal.Dialog>
      </HeroModal.Container>
    </HeroModal.Backdrop>
  );
}

export function StageEvidenceSheet({ stage, onOpenChange, report, onReviewAction }: { stage: PerformanceStage | null; onOpenChange: (open: boolean) => void; report: DashboardReport; onReviewAction: () => void }) {
  const model = stage ? stageEvidence(stage, report) : null;
  return (
    <Sheet open={Boolean(stage)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l border-border bg-popover sm:max-w-[480px]">
        {stage && model ? <><SheetHeader className="p-6"><Badge className="mb-2 w-fit" variant={stage.availability === "available" ? "secondary" : "outline"}>{stage.category}</Badge><SheetTitle className="text-xl font-semibold">{stage.name} evidence</SheetTitle><SheetDescription>{stage.relation} · {stage.availability === "not_tracked" ? "tracking required" : stage.efficiency}</SheetDescription></SheetHeader><div className="grid gap-5 px-6 pb-6"><div className="rounded-2xl bg-card p-4"><div className="flex items-center justify-between text-[10px] uppercase tracking-[0.06em] text-muted-foreground"><span>{model.signalLabel}</span><Badge variant={stage.availability === "available" ? "success" : "outline"}>{model.statusLabel}</Badge></div><div className="mt-3 text-base font-semibold">{model.headline}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{model.description}</p></div><div><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{model.contributorsTitle}</h3><Badge variant="outline">{model.contributorsBadge}</Badge></div>{model.contributors.map((row) => <div key={row.title} className="rounded-xl px-3 py-2.5"><div className="text-sm font-medium">{row.title}</div><div className="mt-0.5 text-xs text-muted-foreground">{row.detail}</div></div>)}</div><AccordionList items={model.accordions} /></div><SheetFooter className="flex-row justify-end border-t border-border bg-popover p-6"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button onClick={onReviewAction}>{model.ctaLabel}</Button></SheetFooter></> : null}
      </SheetContent>
    </Sheet>
  );
}

export function EntityDetailSheet({ row, onOpenChange, report, onOpenAction }: { row: NormalizedRow | null; onOpenChange: (open: boolean) => void; report: DashboardReport; onOpenAction: () => void }) {
  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l border-border bg-popover sm:max-w-[480px]">
        {row ? <><SheetHeader className="p-6"><Badge className="mb-2 w-fit" variant="secondary">Entity detail</Badge><SheetTitle className="text-xl font-semibold">{row.name}</SheetTitle><SheetDescription>Campaign → Ad set → Ad</SheetDescription></SheetHeader><div className="grid gap-5 px-6 pb-6"><div className="rounded-2xl bg-card p-4"><div className="flex items-center justify-between text-[10px] uppercase tracking-[0.06em] text-muted-foreground"><span>Entity decision</span><Badge variant={row.frequency >= 3 ? "outline" : "success"}>{row.frequency >= 3 ? "Review" : "Healthy"}</Badge></div><div className="mt-3 text-base font-semibold">CTR {row.ctr.toFixed(2)}% · CPA {currency(row.cpaPurchase || row.cpl || row.costPerMessage || row.cpc, report.account.currency || "VND")}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Entity drill-down keeps stage metrics, trend, creative and provenance in one evidence chain.</p></div><div><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Evidence chain</h3><Badge variant="outline">3 levels</Badge></div>{[row.campaignName || report.campaignRows[0]?.name, row.adsetName || row.name, row.name].filter(Boolean).map((name, index) => <div key={`${name}-${index}`} className="rounded-xl px-3 py-2"><div className="text-sm font-medium">{name}</div><div className="text-xs text-muted-foreground">{index === 0 ? "Campaign" : index === 1 ? "Ad set" : "Ad"} · spend {currency(row.spend, report.account.currency || "VND")}</div></div>)}</div><AccordionList items={[["Stage metrics", `CTR ${row.ctr.toFixed(2)}% · CPC ${currency(row.cpc, report.account.currency || "VND")} · frequency ${row.frequency.toFixed(1)}.`], ["Period movement", `Spend ${currency(row.spend, report.account.currency || "VND")} in the selected period.`], ["Breakdowns", topPlacement(report)], ["Creative preview", row.adFormat || "Creative preview is available when Meta returns the asset."], ["Recommended action", row.frequency >= 3 ? "Refresh the opening while preserving the proven hook." : "Keep this entity in the active mix and monitor efficiency."], ["Evidence provenance", "Campaign, ad set and ad rows share the same selected scope."]]} /></div><SheetFooter className="flex-row justify-end border-t border-border bg-popover p-6"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button onClick={onOpenAction}>Open action</Button></SheetFooter></> : null}
      </SheetContent>
    </Sheet>
  );
}

export function CreativeComparisonDialog({ open, onOpenChange, rows, report, onOpenEvidence }: { open: boolean; onOpenChange: (open: boolean) => void; rows: NormalizedRow[]; report: DashboardReport; onOpenEvidence: () => void }) {
  const control = rows[0];
  const challenger = rows[1];
  const currencyCode = report.account.currency || "VND";
  const verdict = control && challenger ? buildCreativeComparisonVerdict(control, challenger, report.selectedPack, currencyCode) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 max-w-[884px] flex-col overflow-hidden rounded-3xl border border-border bg-popover p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 sm:px-6">
          <DialogTitle className="text-xl font-semibold">Compare creatives</DialogTitle>
          <DialogDescription className="mt-1">Creative 1 stays the control; Creative 2 is the challenger. The verdict uses only this selected pair and the active KPI pack.</DialogDescription>
        </DialogHeader>
        {control && challenger && verdict ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 md:grid-cols-2">
              <CreativeSummary report={report} row={control} label="Creative 1 · Control" selectedRole="Control" currencyCode={currencyCode} />
              <CreativeSummary report={report} row={challenger} label="Creative 2 · Challenger" selectedRole="Challenger" currencyCode={currencyCode} />
            </div>
            <div className="mt-5 rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Decision matrix</h3><Badge variant="outline">{report.selectedPack.replaceAll("_", " ")}</Badge></div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="text-muted-foreground"><tr><th className="py-2">Metric</th><th>Creative 1 · Control</th><th>Creative 2 · Challenger</th><th>Readout</th></tr></thead>
                  <tbody>{comparisonRows(control, challenger, verdict, currencyCode).map((item) => <tr key={item.label} className="border-t border-border/60"><td className="py-2.5 text-muted-foreground">{item.label}</td><td>{item.control}</td><td>{item.challenger}</td><td>{item.readout}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className={cn("mt-5 flex gap-3 rounded-2xl border p-4", verdict.winner === "insufficient" || verdict.winner === "tie" ? "border-warning/40 bg-warning/8" : "border-primary/30 bg-primary/7")}>
              <GitCompareArrowsIcon className={cn("mt-0.5 size-5 shrink-0", verdict.winner === "insufficient" || verdict.winner === "tie" ? "text-warning" : "text-primary")} />
              <div><div className="font-semibold">{verdict.title}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{verdict.detail}</p></div>
            </div>
          </div>
        ) : <div className="py-16 text-center text-sm text-muted-foreground">Select exactly two creative rows to compare.</div>}
        <DialogFooter className="shrink-0 border-t border-border px-5 py-4 sm:px-6"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button onClick={onOpenEvidence}><ShieldCheckIcon data-icon="inline-start" />Open selected evidence</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccordionList({ items }: { items: [string, string][] }) {
  return <div className="divide-y divide-border border-y border-border">{items.map(([label, detail]) => <Collapsible key={label}><CollapsibleTrigger className="flex w-full items-center justify-between py-3 text-left text-sm font-medium">{label}<span className="text-muted-foreground">⌄</span></CollapsibleTrigger><CollapsibleContent className="pb-3 text-xs leading-5 text-muted-foreground">{detail || "No additional evidence is available."}</CollapsibleContent></Collapsible>)}</div>;
}

function CreativeSummary({ report, row, label, selectedRole, currencyCode }: { report: DashboardReport; row: NormalizedRow; label: string; selectedRole: "Control" | "Challenger"; currencyCode: string }) {
  return <div><div className="mb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</div><div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 rounded-2xl bg-card p-3"><MetaCreativeCover report={report} row={row} className="min-h-36" /><div className="min-w-0 py-2"><div className="flex items-start justify-between gap-2"><h3 className="min-w-0 truncate font-semibold">{row.name}</h3><Badge variant={selectedRole === "Control" ? "success" : "secondary"}>{selectedRole}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{row.adsetName || row.campaignName}</p><div className="mt-4 grid grid-cols-2 gap-3 text-[10px] uppercase text-muted-foreground"><span>Spend<b className="block text-xs normal-case text-foreground">{currency(row.spend, currencyCode)}</b></span><span>Impressions<b className="block text-xs normal-case text-foreground">{compact(row.impressions)}</b></span><span>CTR<b className="block text-xs normal-case text-foreground">{row.ctr.toFixed(2)}%</b></span><span>Frequency<b className="block text-xs normal-case text-foreground">{row.frequency.toFixed(1)}</b></span></div></div></div></div>;
}

function comparisonRows(control: NormalizedRow, challenger: NormalizedRow, verdict: ReturnType<typeof buildCreativeComparisonVerdict>, currencyCode: string) {
  return [
    { label: verdict.resultLabel, control: trackedNumber(verdict.controlResult), challenger: trackedNumber(verdict.challengerResult), readout: resultReadout(verdict.controlResult, verdict.challengerResult) },
    { label: verdict.costLabel, control: trackedCurrency(verdict.controlCost, currencyCode), challenger: trackedCurrency(verdict.challengerCost, currencyCode), readout: costReadout(verdict.controlCost, verdict.challengerCost) },
    { label: "CTR", control: `${control.ctr.toFixed(2)}%`, challenger: `${challenger.ctr.toFixed(2)}%`, readout: `${Math.abs(control.ctr - challenger.ctr).toFixed(2)} pp · ${control.ctr >= challenger.ctr ? "Control" : "Challenger"}` },
    { label: "CPM", control: currency(control.cpm, currencyCode), challenger: currency(challenger.cpm, currencyCode), readout: control.cpm <= challenger.cpm ? "Lower · Control" : "Lower · Challenger" },
    { label: "Frequency", control: control.frequency.toFixed(1), challenger: challenger.frequency.toFixed(1), readout: `${Math.abs(control.frequency - challenger.frequency).toFixed(1)} lower · ${control.frequency <= challenger.frequency ? "Control" : "Challenger"}` },
  ];
}

function trackedNumber(value: number | null) {
  return value === null ? "Not tracked" : compact(value);
}

function trackedCurrency(value: number | null, currencyCode: string) {
  return value === null ? "Unavailable" : currency(value, currencyCode);
}

function resultReadout(control: number | null, challenger: number | null) {
  if (control === null || challenger === null) return "Tracking unavailable";
  if (control === challenger) return "Equal observed volume";
  return `Higher · ${control > challenger ? "Control" : "Challenger"}`;
}

function costReadout(control: number | null, challenger: number | null) {
  if (control === null || challenger === null) return "Cost unavailable";
  if (control === challenger) return "Equal observed cost";
  return `Lower · ${control < challenger ? "Control" : "Challenger"}`;
}

function actionSignals(report: DashboardReport) {
  const totals = report.totals;
  const currencyCode = report.account.currency || "VND";
  const result = report.selectedPack === "sales_roas" ? totals.purchases : report.selectedPack === "lead_gen" ? totals.leads : report.selectedPack === "messages" ? totals.messages : report.selectedPack === "traffic" ? totals.linkClicks : totals.reach;
  const rateBase = report.selectedPack === "awareness" ? totals.impressions : totals.linkClicks;
  return [
    { title: "Stage rate", detail: `${compact(result)} selected outcomes from ${compact(rateBase)} upstream events.` },
    { title: "Delivery pressure", detail: `Frequency ${totals.frequency.toFixed(1)} · CPM ${currency(totals.cpm, currencyCode)}.` },
    { title: "Traffic quality", detail: `Link CTR ${linkCtr(totals).toFixed(2)}% · Link CPC ${currency(linkCpc(totals), currencyCode)}.` },
  ];
}

function actionImpact(report: DashboardReport, index: number) {
  if (index === 1) return report.selectedPack === "sales_roas" ? "CPA <= target x 1.45 for 3 consecutive days" : "Hold scale until the primary cost guardrail is stable for 3 days";
  if (report.selectedPack === "sales_roas") return "Directional CPA improvement: 9-14%";
  if (report.selectedPack === "lead_gen") return "Protect lead quality while reducing CPL variance";
  if (report.selectedPack === "messages") return "Improve conversation efficiency without losing reply quality";
  if (report.selectedPack === "traffic") return "Lower Link CPC while preserving Link CTR";
  return "Expand unique reach while keeping frequency below 4.0";
}

function actionGuardrail(report: DashboardReport) {
  if (report.selectedPack === "sales_roas") return "Do not increase spend while CPA is above target or purchase tracking is unavailable.";
  if (report.selectedPack === "lead_gen") return "Scale only when CPL holds and qualified-lead verification is available.";
  if (report.selectedPack === "messages") return "Scale only when cost/message and reply rate remain stable together.";
  if (report.selectedPack === "traffic") return "Do not infer downstream conversion from link clicks; protect Link CTR while reducing Link CPC.";
  return "Review at frequency 4.0, or when CPM rises as unique reach stalls.";
}

function actionSuccessMeasure(report: DashboardReport) {
  if (report.selectedPack === "sales_roas") return "Checkout rate improves and CPA returns inside target without ROAS deterioration.";
  if (report.selectedPack === "lead_gen") return "CPL improves while CRM-qualified lead rate remains stable or rises.";
  if (report.selectedPack === "messages") return "Cost/message improves without a decline in reply rate.";
  if (report.selectedPack === "traffic") return "Link CPC declines while Link CTR and landing-page quality remain stable.";
  return "Unique reach grows while frequency remains below the saturation guardrail.";
}

type StageEvidenceModel = {
  signalLabel: string;
  statusLabel: string;
  headline: string;
  description: string;
  contributorsTitle: string;
  contributorsBadge: string;
  contributors: Array<{ title: string; detail: string }>;
  accordions: [string, string][];
  ctaLabel: string;
};

function stageEvidence(stage: PerformanceStage, report: DashboardReport): StageEvidenceModel {
  const totals = report.totals;
  const currencyCode = report.account.currency || "VND";
  const tracked = stage.availability === "available";
  const notTracked = stage.availability === "not_tracked";
  const metricDefinition = stageDefinition(stage.key);
  const sourceRows = ["exposure", "reach", "impressions", "saturation"].includes(stage.key)
    ? report.platformRows
    : report.adsetRows;
  const rows = [...sourceRows].sort((a, b) => stageRowValue(b, stage.key) - stageRowValue(a, stage.key)).slice(0, 3);
  const contributors = rows.map((row) => ({
    title: row.name,
    detail: stageRowDetail(row, stage.key, currencyCode),
  }));
  const statusLabel = notTracked ? "Tracking gap" : stage.availability === "insufficient" ? "Insufficient data" : "Sufficient data";
  const headline = stageHeadline(stage, report);
  const description = notTracked
    ? `${metricDefinition} Missing events remain Not tracked; the interface never converts them into zero.`
    : stageDescription(stage.key, report);
  const splitLabel = ["traffic"].includes(stage.key) ? "Creative split" : ["conversations"].includes(stage.key) ? "Hook split" : ["replies"].includes(stage.key) ? "Channel split" : "Placement split";
  const dataSufficiency = notTracked
    ? `${stage.name} events are unavailable in the selected Meta rows.`
    : stage.availability === "insufficient"
      ? `The source is connected, but this scope does not contain enough ${stage.unit} to judge the stage.`
      : `${compact(stage.value || 0)} tracked ${stage.unit} are available in the selected scope.`;
  const recommendedAction = notTracked
    ? `Reconnect ${stage.name.toLowerCase()} tracking before making a downstream scaling decision.`
    : stage.tone === "warning"
      ? "Hold the next scale move and repair this stage before increasing delivery."
      : stage.key === "saturation"
        ? "Keep delivery stable and rotate creative before frequency reaches 4.0."
        : "Keep the stage stable while monitoring downstream quality.";
  return {
    signalLabel: stageSignalLabel(stage.key),
    statusLabel,
    headline,
    description,
    contributorsTitle: stageContributorsTitle(stage.key),
    contributorsBadge: notTracked ? "Event missing" : contributors.length ? `${contributors.length} points` : "No split",
    contributors: contributors.length ? contributors : [{ title: "No contributor rows", detail: "Meta did not return a usable split for this stage." }],
    accordions: stage.key === "saturation" ? [
      ["Guardrail definition", metricDefinition],
      ["Current status", stage.efficiency],
      ["Cost-pressure signal", "Escalate if CPM rises 30% while reach falls 5% or more."],
      ["Attention quality", `CTR ${totals.ctr.toFixed(2)}% is read with frequency, never alone.`],
      ["Recommended action", recommendedAction],
      ["Methodology", "True fatigue requires creative-level CTR decline over time."],
    ] : [
      ["Metric definition", metricDefinition],
      ["Data sufficiency", dataSufficiency],
      ["Period movement", stage.movement],
      [splitLabel, topPlacement(report)],
      ["Recommended action", recommendedAction],
      ["Methodology", stageMethodology(stage.key)],
    ],
    ctaLabel: notTracked ? `Fix ${stage.name.toLowerCase()} tracking` : stage.key === "saturation" ? "Open action plan" : `Review ${stage.name.toLowerCase()}`,
  };
}

function stageHeadline(stage: PerformanceStage, report: DashboardReport) {
  const totals = report.totals;
  const currencyCode = report.account.currency || "VND";
  if (stage.availability === "not_tracked") return `${stage.name} events are unavailable for this scope`;
  if (stage.key === "exposure") return `${compact(totals.impressions)} impressions ÷ ${compact(totals.reach)} reach = ${totals.frequency.toFixed(1)} frequency`;
  if (stage.key === "reach") return `${compact(totals.reach)} unique people reached`;
  if (stage.key === "impressions") return `${compact(totals.impressions)} impressions · CPM ${currency(totals.cpm, currencyCode)} · frequency ${totals.frequency.toFixed(1)}`;
  if (stage.key === "traffic") return `${compact(totals.linkClicks)} link clicks ÷ ${compact(totals.impressions)} impressions = ${linkCtr(totals).toFixed(2)}%`;
  if (stage.key === "cart") return `${compact(totals.addToCart)} add to carts · Cost / ATC ${currency(safeCost(totals.spend, totals.addToCart), currencyCode)}`;
  if (stage.key === "checkout") return `${compact(totals.initiateCheckout)} checkouts · Cart → checkout ${ratioPct(totals.initiateCheckout, totals.addToCart)}`;
  if (stage.key === "purchase") return `${compact(totals.purchases)} purchases · CPA ${currency(totals.cpaPurchase, currencyCode)} · ROAS ${totals.roas.toFixed(1)}`;
  if (stage.key === "lead") return `${compact(totals.leads)} Meta lead events · CPL ${currency(totals.cpl, currencyCode)}`;
  if (stage.key === "conversations") return `${compact(totals.messages)} conversations · Cost / message ${currency(totals.costPerMessage, currencyCode)}`;
  if (stage.key === "replies") return `${compact(totals.replies)} replies · Reply rate ${totals.replyRate.toFixed(1)}%`;
  return `${totals.frequency.toFixed(1)} frequency · CPM ${currency(totals.cpm, currencyCode)} · CTR ${totals.ctr.toFixed(2)}%`;
}

function stageDescription(key: PerformanceStage["key"], report: DashboardReport) {
  if (key === "exposure" || key === "impressions" || key === "reach") return "Delivery is read with reach, impressions, CPM and frequency; it is not treated as a conversion stage.";
  if (key === "traffic") return "Link CTR uses link clicks only. Link CPC equals spend divided by link clicks; Meta all-click CTR/CPC stays secondary.";
  if (key === "lead") return "Meta lead events are tracked here; qualified lead quality remains unavailable until CRM stages are connected.";
  if (key === "conversations") return "A conversation is a new messaging thread. Cost/message equals spend divided by conversations.";
  if (key === "replies") return "Reply rate equals replies divided by conversations; cost/reply equals spend divided by replies.";
  if (key === "saturation") return "Read frequency, CPM and CTR together. Review at frequency 4.0, or when CPM rises as reach stalls.";
  return `The selected ${report.selectedPack} pack uses this tracked event as a real funnel stage.`;
}

function stageDefinition(key: PerformanceStage["key"]) {
  if (key === "exposure" || key === "impressions") return "Frequency = impressions ÷ reach; CPM = spend ÷ impressions × 1,000.";
  if (key === "reach") return "Reach counts unique people who received at least one impression.";
  if (key === "traffic") return "Link CTR = link clicks ÷ impressions; Link CPC = spend ÷ link clicks.";
  if (key === "cart") return "Click-to-cart rate = add-to-cart events ÷ link clicks; Cost / ATC = spend ÷ add-to-cart events.";
  if (key === "checkout") return "Cart-to-checkout rate = checkout events ÷ add-to-cart events.";
  if (key === "purchase") return "Checkout-to-purchase rate = purchases ÷ checkouts; CPA = spend ÷ purchases.";
  if (key === "lead") return "Lead rate = verified lead events ÷ link clicks; CPL = spend ÷ verified lead events.";
  if (key === "conversations") return "Conversation rate = new conversations ÷ link clicks; cost/message = spend ÷ conversations.";
  if (key === "replies") return "Reply rate = replies ÷ conversations; cost/reply = spend ÷ replies.";
  return "Frequency plus CTR is a quick saturation proxy; investigate with CPM and reach movement.";
}

function stageSignalLabel(key: PerformanceStage["key"]) {
  if (key === "traffic") return "Link click efficiency";
  if (key === "lead") return "Click → lead";
  if (key === "conversations") return "Click → conversation";
  if (key === "replies") return "Conversation → reply";
  if (key === "saturation") return "Frequency / CPM / CTR";
  if (key === "cart") return "Click → cart";
  if (key === "checkout") return "Cart → checkout";
  if (key === "purchase") return "Checkout → purchase";
  return "Delivery efficiency";
}

function stageContributorsTitle(key: PerformanceStage["key"]) {
  if (key === "traffic") return "What drives traffic cost";
  if (key === "lead") return "Where lead quality must be verified";
  if (key === "conversations") return "Where conversation intent appears";
  if (key === "replies") return "Where reply quality breaks";
  if (key === "saturation") return "Guardrail evidence";
  if (key === "impressions") return "Where impression volume comes from";
  if (key === "reach" || key === "exposure") return "Where delivery pressure sits";
  return "Where the signal comes from";
}

function stageMethodology(key: PerformanceStage["key"]) {
  if (key === "traffic") return "All-click Meta CTR/CPC remains available in Evidence, not in the funnel rail.";
  if (key === "lead") return "Meta lead events prove form completion, not CRM-qualified outcome quality.";
  if (key === "conversations" || key === "replies") return "Meta messaging events are shown as Not tracked when absent.";
  if (key === "reach" || key === "impressions" || key === "exposure") return "Delivery metrics diagnose distribution volume, not downstream conversion.";
  return "Stage evidence uses normalized Meta rows from the active account, campaign and period scope.";
}

function stageRowValue(row: NormalizedRow, key: PerformanceStage["key"]) {
  if (key === "traffic") return row.linkClicks;
  if (key === "cart") return row.addToCart;
  if (key === "checkout") return row.initiateCheckout;
  if (key === "purchase") return row.purchases;
  if (key === "lead") return row.leads;
  if (key === "conversations") return row.messages;
  if (key === "replies") return row.replies;
  if (key === "reach") return row.reach;
  if (key === "saturation") return row.frequency;
  return row.impressions;
}

function stageRowDetail(row: NormalizedRow, key: PerformanceStage["key"], currencyCode: string) {
  if (key === "traffic") return `Link CTR ${linkCtr(row).toFixed(2)}% · Link CPC ${currency(linkCpc(row), currencyCode)}`;
  if (key === "cart") return `${compact(row.addToCart)} add to carts · Cost / ATC ${currency(safeCost(row.spend, row.addToCart), currencyCode)}`;
  if (key === "checkout") return `${compact(row.initiateCheckout)} checkouts · ${ratioPct(row.initiateCheckout, row.addToCart)} from cart`;
  if (key === "purchase") return `${compact(row.purchases)} purchases · CPA ${currency(row.cpaPurchase, currencyCode)}`;
  if (key === "lead") return `${compact(row.leads)} leads · CPL ${currency(row.cpl, currencyCode)}`;
  if (key === "conversations") return `${compact(row.messages)} conversations · ${currency(row.costPerMessage, currencyCode)} per message`;
  if (key === "replies") return `${compact(row.replies)} replies · ${row.replyRate.toFixed(1)}% reply rate`;
  if (key === "reach") return `${compact(row.reach)} reached · frequency ${row.frequency.toFixed(1)}`;
  return `${compact(row.impressions)} impressions · CPM ${currency(row.cpm, currencyCode)} · frequency ${row.frequency.toFixed(1)}`;
}

function linkCtr(row: NormalizedRow) {
  return row.impressions > 0 ? (row.linkClicks / row.impressions) * 100 : 0;
}

function linkCpc(row: NormalizedRow) {
  return safeCost(row.spend, row.linkClicks);
}

function safeCost(spend: number, result: number) {
  return result > 0 ? spend / result : 0;
}

function ratioPct(top: number, bottom: number) {
  return `${(bottom > 0 ? (top / bottom) * 100 : 0).toFixed(1)}%`;
}

function buildReportCsv(report: DashboardReport): ClientReportPdfFile {
  const rows = report.adRows.length ? report.adRows : report.adsetRows.length ? report.adsetRows : report.campaignRows;
  const headers = ["name", "level", "spend", "impressions", "reach", "linkClicks", "ctr", "cpc", "cpm", "frequency", "leads", "messages", "purchases", "cpaPurchase", "roas"] as const;
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
  return {
    filename: exportFilename(report, "csv"),
    blob: new Blob([csv], { type: "text/csv;charset=utf-8" }),
  };
}

function exportFilename(report: DashboardReport, format: "pdf" | "csv") {
  return format === "pdf"
    ? `performance-diagnosis-${report.dateRange.until}.pdf`
    : `performance-diagnosis-metrics-${report.dateRange.until}.csv`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function campaignStatus(campaign: MetaCampaign) {
  return String(campaign.effective_status || campaign.status || "UNKNOWN").toUpperCase();
}

function formatObjective(objective: string | undefined, language: InterfaceLanguage) {
  if (!objective) return language === "vi" ? "Chưa có mục tiêu" : "No objective";
  const value = objective.replace(/^OUTCOME_/, "").replaceAll("_", " ").toLocaleLowerCase();
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function formatBudget(campaign: MetaCampaign, currencyCode: string) {
  const raw = Number(campaign.daily_budget || campaign.lifetime_budget || 0);
  if (!raw) return "";
  return ` · ${currency(raw / 100, currencyCode)}${campaign.daily_budget ? "/day" : " lifetime"}`;
}

function packLabel(pack: KpiPack, language: InterfaceLanguage) {
  return localizedKpiOptions(language).find((item) => item.value === pack)?.label || pack;
}

function defaultDecision(report: DashboardReport, language: InterfaceLanguage) {
  if (language === "vi") {
    if (report.selectedPack === "sales_roas") return "Bảo vệ ngân sách. Sửa bước chuyển đổi yếu nhất trước khi scale.";
    if (report.selectedPack === "lead_gen") return "Bảo vệ chất lượng lead trước khi tăng volume.";
    if (report.selectedPack === "messages") return "Bảo vệ chất lượng hội thoại trước khi tăng phân phối.";
    if (report.selectedPack === "traffic") return "Giảm CPC mà không đánh đổi chất lượng traffic.";
    return "Mở rộng tiếp cận trong khi giữ tần suất dưới ngưỡng fatigue.";
  }
  if (report.selectedPack === "sales_roas") return "Protect budget. Fix the weakest conversion step before scaling.";
  if (report.selectedPack === "lead_gen") return "Protect lead quality before increasing volume.";
  if (report.selectedPack === "messages") return "Protect conversation quality before increasing delivery.";
  if (report.selectedPack === "traffic") return "Reduce CPC without trading away traffic quality.";
  return "Expand reach while keeping frequency below fatigue risk.";
}

function actionTitle(action: string, index: number, language: InterfaceLanguage) {
  const text = action.toLowerCase();
  if (text.includes("budget") || text.includes("scale") || text.includes("ngân sách")) return language === "vi" ? "Bảo vệ lần scale tiếp theo" : "Protect the next scale move";
  if (text.includes("creative") || text.includes("hook")) return language === "vi" ? "Làm mới evidence creative" : "Refresh creative evidence";
  return language === "vi" ? (index === 0 ? "Xử lý điểm nghẽn chính" : "Chạy thử nghiệm có đối chứng") : (index === 0 ? "Address the primary constraint" : "Run a controlled test");
}

function topPlacement(report: DashboardReport) {
  const top = [...report.platformRows].sort((a, b) => b.spend - a.spend)[0];
  return top ? `${top.name} carries the largest tracked share at ${currency(top.spend, report.account.currency || "VND")}.` : "Placement evidence is unavailable for this scope.";
}

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function currency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency: currencyCode, notation: Math.abs(value) >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value || 0));
}
