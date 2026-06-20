"use client";

import * as React from "react";
import { ArrowRightIcon, DownloadIcon, FileTextIcon, RefreshCcwIcon, SparklesIcon } from "lucide-react";
import { buildClientStory, type ClientStory } from "@/lib/client-story";
import type { AiInsightTable, CompareMode, DashboardReport, InterfaceLanguage, Verdict } from "@/lib/types";
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
}) {
  const copy = COPY[language];
  const story = buildClientStory({ report, previousReport, verdict, insights, compareMode, language });

  function handleJump(sectionId: SectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]" data-print-flow>
      <aside className="hidden xl:block" data-print-hidden>
        <div className="sticky top-4 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
          <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.storyDraft}</div>
          {SECTION_IDS.map((sectionId) => (
            <button
              key={sectionId}
              type="button"
              onClick={() => handleJump(sectionId)}
              className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copy.sections[sectionId]}
              <ArrowRightIcon className="size-3.5" />
            </button>
          ))}
        </div>
      </aside>

      <article className="flex min-w-0 flex-col gap-4">
        <StoryHero story={story} verdict={verdict} copy={copy} loadingVerdict={loadingVerdict} onGenerateVerdict={onGenerateVerdict} />
        <KpiSnapshot id="kpi-snapshot" story={story} title={copy.sections["kpi-snapshot"]} />
        <WhatChanged id="what-changed" story={story} title={copy.sections["what-changed"]} fallback={copy.noComparison} />
        <WhyItChanged id="why-it-changed" story={story} title={copy.sections["why-it-changed"]} />
        <NextActions id="next-actions" story={story} title={copy.sections["next-actions"]} />
        <section id="evidence-appendix" className="scroll-mt-4" data-print-flow>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{copy.sections["evidence-appendix"]}</CardTitle>
              <CardDescription>{copy.appendix}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">{appendix}</CardContent>
          </Card>
        </section>
      </article>

      <aside className="flex min-w-0 flex-col gap-4" data-print-hidden>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{report.account.name}</CardTitle>
            <CardDescription>{story.reportLabel}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onEditScope}>{copy.editScope}</Button>
            <Button type="button" onClick={onRefreshReport} disabled={loadingReport}>
              {loadingReport ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
              {copy.refresh}
            </Button>
            <Button type="button" variant="outline" onClick={onExportReport}>
              <DownloadIcon data-icon="inline-start" />
              {copy.exportReport}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{copy.evidence}</CardTitle>
            <CardDescription>{story.verdict.confidence}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {story.evidenceGroups.map((group) => (
              <div key={group.id} className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="text-sm font-medium text-foreground">{group.title}</div>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {group.items.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
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
            <Badge variant="outline">{story.verdict.confidence}</Badge>
          </div>
          <div className="max-w-4xl font-heading text-4xl font-semibold leading-[0.95] tracking-[-0.05em] md:text-6xl">
            {story.headline}
          </div>
          <CardDescription className="max-w-3xl text-base leading-relaxed">{story.verdict.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-6 md:grid-cols-3 md:px-8 md:pb-8">
          {story.executiveSummary.map((summary, index) => (
            <div key={summary} className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</div>
              <p className="text-sm leading-relaxed text-foreground">{summary}</p>
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

function KpiSnapshot({ id, story, title }: { id: string; story: ClientStory; title: string }) {
  return (
    <section id={id} className="scroll-mt-4" data-print-flow>
      <div className="mb-2 text-sm font-medium text-muted-foreground">{title}</div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {story.kpis.map((kpi) => (
          <Card key={kpi.key} size="sm" className="rounded-2xl">
            <CardHeader>
              <CardDescription className="text-xs font-medium uppercase tracking-wide">{kpi.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums leading-none">{kpi.value}</CardTitle>
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
            <div key={change.label} className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="text-sm font-medium text-foreground">{change.label}</div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div className="text-2xl font-semibold tabular-nums">{change.current}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Previous</div>
                  <div className="text-sm tabular-nums text-muted-foreground">{change.previous}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{change.summary}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{fallback}</p>
      )}
    </StorySection>
  );
}

function WhyItChanged({ id, story, title }: { id: string; story: ClientStory; title: string }) {
  return (
    <StorySection id={id} title={title}>
      <div className="grid gap-2">
        {story.whyItChanged.map((cause) => (
          <div key={cause} className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground">{cause}</div>
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
          <div key={`${action.title}-${index}`} className="rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</div>
              <div className="min-w-0">
                <div className="font-medium text-foreground">{action.title}</div>
                <p className="mt-2 text-sm text-muted-foreground">{action.reason}</p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <div className="rounded-xl bg-background/60 p-3"><span className="text-foreground">Risk/control:</span> {action.risk}</div>
                  <div className="rounded-xl bg-background/60 p-3"><span className="text-foreground">Evidence:</span> {action.evidence}</div>
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
    <section id={id} className="scroll-mt-4" data-print-flow>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
