"use client";

import * as React from "react";
import { ArrowRightIcon, DownloadIcon, FileTextIcon, RefreshCcwIcon, SparklesIcon } from "lucide-react";
import { buildClientStory, type ClientStory } from "@/lib/client-story";
import {
  CUSTOM_KPI_SET_STORAGE_KEY,
  type CustomKpiKey,
  deserializeCustomKpiSet,
  getCustomKpiCatalogGroups,
  serializeCustomKpiSet,
  buildCustomKpiCards,
} from "@/lib/custom-kpi-set";
import { SlidersHorizontalIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { AiInsightTable, CompareMode, DashboardReport, InterfaceLanguage, Verdict, KpiCard } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const SECTION_IDS = [
  "client-story",
  "kpi-snapshot",
  "what-changed",
  "why-it-changed",
  "next-actions",
  "evidence-appendix",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

type Copy = {
  sections: Record<SectionId, string>;
  evidence: string;
  editScope: string;
  refresh: string;
  generateVerdict: string;
  exportReport: string;
  storyDraft: string;
  appendix: string;
  noComparison: string;
};

const COPY: Record<InterfaceLanguage, Copy> = {
  en: {
    sections: {
      "client-story": "Client Story",
      "kpi-snapshot": "KPI Snapshot",
      "what-changed": "What Changed",
      "why-it-changed": "Why It Changed",
      "next-actions": "Next Actions",
      "evidence-appendix": "Evidence Appendix",
    },
    evidence: "Evidence",
    editScope: "Edit scope",
    refresh: "Refresh report",
    generateVerdict: "Generate Verdict",
    exportReport: "Export report",
    storyDraft: "Story draft",
    appendix: "Detailed charts, tables, diagnostics, and raw supporting analysis stay available here.",
    noComparison: "No comparison period loaded. Use the comparison setting in scope to explain movement.",
  },
  vi: {
    sections: {
      "client-story": "Câu chuyện khách hàng",
      "kpi-snapshot": "KPI chính",
      "what-changed": "Biến động",
      "why-it-changed": "Nguyên nhân",
      "next-actions": "Hành động tiếp theo",
      "evidence-appendix": "Phụ lục bằng chứng",
    },
    evidence: "Bằng chứng",
    editScope: "Sửa phạm vi",
    refresh: "Kéo lại báo cáo",
    generateVerdict: "Tạo Verdict",
    exportReport: "Xuất báo cáo",
    storyDraft: "Bản nháp câu chuyện",
    appendix: "Biểu đồ, bảng, chẩn đoán và phân tích chi tiết vẫn nằm ở đây.",
    noComparison: "Chưa có kỳ so sánh. Dùng tuỳ chọn so sánh trong phạm vi để giải thích biến động.",
  },
};

export function ClientReportWorkspace({
  report,
  previousReport,
  verdict,
  insights,
  compareMode,
  language,
  loadingReport,
  loadingVerdict,
  onEditScope,
  onRefreshReport,
  onGenerateVerdict,
  onExportReport,
  appendix,
  onSaveCustomKpis,
  customKpiKeys,
  defaultKpis,
}: {
  report: DashboardReport;
  previousReport: DashboardReport | null;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  compareMode: CompareMode;
  language: InterfaceLanguage;
  loadingReport: boolean;
  loadingVerdict: boolean;
  onEditScope: () => void;
  onRefreshReport: () => void;
  onGenerateVerdict: () => void;
  onExportReport: () => void;
  appendix: React.ReactNode;
  onSaveCustomKpis?: (keys: CustomKpiKey[]) => void;
  customKpiKeys?: CustomKpiKey[];
  defaultKpis?: KpiCard[];
}) {
  const copy = COPY[language];
  const story = buildClientStory({ report, previousReport, verdict, insights, compareMode, language });
  const [activeSection, setActiveSection] = React.useState<SectionId>("client-story");
  const primaryAction = verdict ? "export" : "verdict";

  return (
    <div className="grid gap-6 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]" data-print-flow>
      <aside className="hidden xl:block" data-print-hidden>
        <div className="sticky top-6 flex flex-col gap-1 rounded-2xl border border-border/60 bg-card p-2">
          <div className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{copy.storyDraft}</div>
          {SECTION_IDS.map((sectionId) => {
            const selected = activeSection === sectionId;

            return (
              <button
                key={sectionId}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => setActiveSection(sectionId)}
                className={`flex min-h-[44px] items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
              >
                {copy.sections[sectionId]}
                <ArrowRightIcon className={`size-3.5 transition-transform ${selected ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"}`} />
              </button>
            );
          })}
        </div>
      </aside>

      <article className="flex min-w-0 flex-col gap-4">
        <MobileSectionNav activeSection={activeSection} copy={copy} onChange={setActiveSection} />
        {activeSection === "client-story" ? <StoryHero story={story} verdict={verdict} copy={copy} loadingVerdict={loadingVerdict} onGenerateVerdict={onGenerateVerdict} /> : null}
        {activeSection === "kpi-snapshot" ? <KpiSnapshot id="kpi-snapshot" story={story} title={copy.sections["kpi-snapshot"]} onSaveCustomKpis={onSaveCustomKpis} customKpiKeys={customKpiKeys} defaultKpis={defaultKpis} language={language} /> : null}
        {activeSection === "what-changed" ? <WhatChanged id="what-changed" story={story} title={copy.sections["what-changed"]} fallback={copy.noComparison} /> : null}
        {activeSection === "why-it-changed" ? <WhyItChanged id="why-it-changed" story={story} title={copy.sections["why-it-changed"]} /> : null}
        {activeSection === "next-actions" ? <NextActions id="next-actions" story={story} title={copy.sections["next-actions"]} /> : null}
        {activeSection === "evidence-appendix" ? (
          <section id="evidence-appendix" data-print-flow>
            <Card className="rounded-3xl border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{copy.sections["evidence-appendix"]}</CardTitle>
                <CardDescription>{copy.appendix}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">{appendix}</CardContent>
            </Card>
          </section>
        ) : null}
      </article>

      <aside className="flex min-w-0 flex-col gap-4" data-print-hidden>
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>{report.account.name}</CardTitle>
            <CardDescription className="text-xs">{story.reportLabel}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {primaryAction === "verdict" ? (
              <Button type="button" onClick={onGenerateVerdict} disabled={loadingVerdict} className="shadow-[0_0_0_1px_rgba(0,153,255,0.15)] transition-shadow hover:shadow-[0_0_0_2px_rgba(0,153,255,0.3)]">
                {loadingVerdict ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                {copy.generateVerdict}
              </Button>
            ) : (
              <Button type="button" onClick={onExportReport} className="shadow-[0_0_0_1px_rgba(0,153,255,0.15)] transition-shadow hover:shadow-[0_0_0_2px_rgba(0,153,255,0.3)]">
                <DownloadIcon data-icon="inline-start" />
                {copy.exportReport}
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={onEditScope} className="border-border/50">{copy.editScope}</Button>
              <Button type="button" variant="outline" onClick={onRefreshReport} disabled={loadingReport} className="border-border/50">
                {loadingReport ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
                {copy.refresh}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium">{copy.evidence}</CardTitle>
            <CardDescription className="text-xs">Confidence: {story.verdict.confidence}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {story.evidenceGroups.map((group) => (
              <div key={group.id} className="rounded-xl border border-border/40 bg-muted/10 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</div>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-foreground/80">
                  {group.items.map((item, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground/50">•</span> <span className="flex-1">{item}</span></li>)}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function MobileSectionNav({ activeSection, copy, onChange }: { activeSection: SectionId; copy: Copy; onChange: (sectionId: SectionId) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden" data-print-hidden>
      {SECTION_IDS.map((sectionId) => {
        const selected = activeSection === sectionId;

        return (
          <button
            key={sectionId}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(sectionId)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
          >
            {copy.sections[sectionId]}
          </button>
        );
      })}
    </div>
  );
}

function StoryHero({ story, verdict, copy, loadingVerdict, onGenerateVerdict }: { story: ClientStory; verdict: Verdict | null; copy: Copy; loadingVerdict: boolean; onGenerateVerdict: () => void }) {
  return (
    <section id="client-story" className="scroll-mt-4" data-print-flow>
      <Card className="rounded-3xl border-border bg-card">
        <CardHeader className="gap-4 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary"><FileTextIcon data-icon="inline-start" />{story.verdict.status}</Badge>
            <Badge variant="outline" className="border-border/50">{story.verdict.confidence}</Badge>
          </div>
          <div className="max-w-4xl font-heading text-4xl font-medium leading-[0.95] tracking-[-0.03em] md:text-5xl lg:text-7xl lg:leading-[0.85] lg:tracking-[-0.05em]">
            {story.headline}
          </div>
          <CardDescription className="max-w-3xl text-base leading-relaxed text-muted-foreground/80 md:text-lg">{story.verdict.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-6 md:grid-cols-3 md:px-8 md:pb-8">
          {story.executiveSummary.map((summary, index) => (
            <div key={summary} className="rounded-2xl border border-border/40 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
              <div className="mb-3 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</div>
              <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
            </div>
          ))}
          {!verdict ? (
            <Button type="button" className="md:col-span-3" onClick={onGenerateVerdict} disabled={loadingVerdict}>
              {loadingVerdict ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              {copy.generateVerdict}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function KpiSnapshot({ 
  id, 
  story, 
  title, 
  onSaveCustomKpis,
  customKpiKeys,
  defaultKpis,
  language
}: { 
  id: string; 
  story: ClientStory; 
  title: string;
  onSaveCustomKpis?: (keys: CustomKpiKey[]) => void;
  customKpiKeys?: CustomKpiKey[];
  defaultKpis?: KpiCard[];
  language?: InterfaceLanguage;
}) {
  return (
    <section id={id} className="scroll-mt-6" data-print-flow>
      <div className="mb-3 px-1 flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</div>
        {onSaveCustomKpis && customKpiKeys && defaultKpis && language && (
          <CustomKpiSetSheet
            defaultKpis={defaultKpis}
            language={language}
            selectedKeys={customKpiKeys}
            onSave={onSaveCustomKpis}
          />
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {story.kpis.map((kpi) => (
          <Card key={kpi.key} size="sm" className="rounded-3xl border-border/60 transition-shadow hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]">
            <CardHeader className="p-5">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">{kpi.label}</CardDescription>
              <CardTitle className="mt-1 text-3xl font-medium tabular-nums tracking-tight leading-none md:text-4xl">{kpi.value}</CardTitle>
              {kpi.delta ? (
                <CardDescription className={`mt-2 text-xs font-medium ${kpi.delta.direction === "down" ? "text-destructive" : kpi.delta.direction === "up" ? "text-success" : "text-muted-foreground"}`}>
                  {kpi.delta.value} <span className="font-normal text-muted-foreground/70">{kpi.delta.label}</span>
                </CardDescription>
              ) : null}
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}

function WhatChanged({ id, story, title, fallback }: { id: string; story: ClientStory; title: string; fallback: string }) {
  return (
    <StorySection id={id} title={title}>
      {story.whatChanged.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {story.whatChanged.map((change) => (
            <div key={change.label} className="rounded-2xl border border-border/40 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
              <div className="text-sm font-medium text-foreground">{change.label}</div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div className="text-2xl font-medium tracking-tight tabular-nums">{change.current}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Previous</div>
                  <div className="text-sm tracking-tight tabular-nums text-muted-foreground">{change.previous}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{change.summary}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 px-6 py-12 text-center">
          <RefreshCcwIcon className="mb-3 size-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{fallback}</p>
        </div>
      )}
    </StorySection>
  );
}

function WhyItChanged({ id, story, title }: { id: string; story: ClientStory; title: string }) {
  return (
    <StorySection id={id} title={title}>
      <div className="grid gap-3">
        {story.whyItChanged.map((cause) => (
          <div key={cause.id} className="relative overflow-hidden rounded-2xl border border-[rgba(0,153,255,0.15)] bg-muted/20 p-4 transition-colors hover:bg-muted/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-foreground">{cause.title}</div>
              <Badge variant="outline" className="border-border/50 text-[10px]">{cause.confidence}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{cause.evidence}</p>
          </div>
        ))}
      </div>
    </StorySection>
  );
}

function NextActions({ id, story, title }: { id: string; story: ClientStory; title: string }) {
  return (
    <StorySection id={id} title={title}>
      <div className="grid gap-3">
        {story.nextActions.map((action, index) => (
          <div key={`${action.title}-${index}`} className="relative overflow-hidden rounded-2xl border border-[rgba(0,153,255,0.15)] bg-muted/20 p-4 transition-colors hover:bg-muted/30">
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">{index + 1}</div>
              <div className="min-w-0">
                <div className="font-medium text-foreground">{action.title}</div>
                <p className="mt-2 text-sm text-muted-foreground">{action.reason}</p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <div className="rounded-xl bg-background/40 p-3 ring-1 ring-border/30"><span className="font-medium text-foreground/90">Risk/control:</span> {action.risk}</div>
                  <div className="rounded-xl bg-background/40 p-3 ring-1 ring-border/30"><span className="font-medium text-foreground/90">Evidence:</span> {action.evidence}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </StorySection>
  );
}

function StorySection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6" data-print-flow>
      <Card className="rounded-3xl border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}


function CustomKpiSetSheet({
  defaultKpis,
  language,
  selectedKeys,
  onSave,
}: {
  defaultKpis: KpiCard[];
  language: InterfaceLanguage;
  selectedKeys: CustomKpiKey[];
  onSave: (keys: CustomKpiKey[]) => void;
}) {
  const isVietnamese = language === "vi";
  const [open, setOpen] = React.useState(false);
  const [draftKeys, setDraftKeys] = React.useState<CustomKpiKey[]>(selectedKeys);
  const groups = getCustomKpiCatalogGroups(language);
  const selectedSet = React.useMemo(() => new Set(draftKeys), [draftKeys]);
  const selectedCards = buildCustomKpiCards(draftKeys);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setDraftKeys(selectedKeys.length ? selectedKeys : deserializeCustomKpiSet(null, defaultKpis));
  }

  function toggleMetric(key: CustomKpiKey) {
    setDraftKeys((current) => {
      if (current.includes(key)) return current.length > 1 ? current.filter((item) => item !== key) : current;
      return [...current, key];
    });
  }

  function handleSave() {
    if (!draftKeys.length) return;
    onSave(draftKeys);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full text-xs font-medium border-border/60 hover:bg-muted/50">
            <SlidersHorizontalIcon className="mr-1.5 size-3.5" />
            {isVietnamese ? "Tùy chỉnh KPI" : "Customize KPIs"}
          </Button>
        }
      />
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isVietnamese ? "Tùy chỉnh KPI" : "Customize KPIs"}</SheetTitle>
          <SheetDescription>
            {isVietnamese
              ? "Chọn các thẻ KPI hiển thị ở đầu dashboard. Việc này không đổi bộ KPI hoặc Verdict."
              : "Choose the KPI cards shown at the top of the dashboard. This does not change the KPI pack or Verdict."}
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="flex flex-col gap-4 p-4">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isVietnamese ? "KPI đã chọn" : "Selected KPIs"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedCards.map((kpi, index) => (
                <Badge key={kpi.key} variant="secondary">
                  {index + 1}. {kpi.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</div>
                <div className="grid gap-2">
                  {group.metrics.map((metric) => {
                    const checked = selectedSet.has(metric.key);
                    const disabled = checked && draftKeys.length === 1;
                    return (
                      <label
                        key={metric.key}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleMetric(metric.key)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{metric.label}</span>
                          <span className="block text-xs text-muted-foreground">{metric.format}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Button type="button" onClick={handleSave} disabled={!draftKeys.length}>
            {isVietnamese ? "Lưu KPI" : "Save KPIs"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
