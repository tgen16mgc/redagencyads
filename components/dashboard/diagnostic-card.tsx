"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Diagnostic, DiagnosticItem, DiagnosticSeverity } from "@/lib/diagnosis";
import { formatMetric, formatSharePct } from "@/lib/metrics";
import type { InterfaceLanguage } from "@/lib/types";

const severityBadgeVariant: Record<DiagnosticSeverity, "secondary" | "outline" | "destructive"> = {
  ok: "secondary",
  watch: "outline",
  risk: "destructive",
  insufficient: "outline",
};

function DiagnosticItems({ items, language }: { items: DiagnosticItem[]; language: InterfaceLanguage }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const hasHeader = Boolean(item.title || item.badge || item.value);
        return (
          <div key={item.id} className="rounded-xl border bg-background/50 px-3 py-2.5 text-sm">
            {hasHeader ? (
              <div className="flex items-start justify-between gap-2">
                {item.title ? <div className="min-w-0 truncate font-medium">{item.title[language]}</div> : null}
                {item.badge ? (
                  <Badge variant={severityBadgeVariant[item.badge.severity]} className="shrink-0 tabular-nums">{item.badge.text[language]}</Badge>
                ) : null}
                {item.value ? <span className="shrink-0 tabular-nums text-muted-foreground">{item.value[language]}</span> : null}
              </div>
            ) : null}
            {item.lines.map((line) => (
              <p key={line.en} className={hasHeader ? "mt-1 text-xs text-muted-foreground" : "text-muted-foreground"}>{line[language]}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function diagnosticCustomBody(diagnostic: Diagnostic, language: InterfaceLanguage, currency: string): React.ReactNode {
  switch (diagnostic.id) {
    case "healthTriage": {
      const summary = diagnostic.health;
      const activeItems = summary.items.filter((item) => item.severity !== "healthy").slice(0, 4);
      const healthyItems = summary.items.filter((item) => item.severity === "healthy");
      const healthyCopy = language === "vi" ? `${summary.counts.healthy} kiểm tra khỏe mạnh` : `${summary.counts.healthy} healthy checks`;
      return (
        <>
          <div className="flex items-end justify-between gap-4 rounded-xl border bg-background/50 p-4">
            <div>
              <div className="text-4xl font-semibold tabular-nums">{summary.score}/100</div>
              <p className="text-sm text-muted-foreground">{summary.summary[language]}</p>
            </div>
            <Badge variant={severityBadgeVariant[diagnostic.severity]}>{language === "vi" ? "Hạng" : "Grade"} {summary.grade}</Badge>
          </div>
          <Separator />
          {activeItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              {activeItems.map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-2.5 ${item.severity === "danger" ? "border-destructive/30 bg-destructive/5" : "bg-background/50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-sm font-medium ${item.severity === "danger" ? "text-destructive" : ""}`}>{item.title[language]}</div>
                    <Badge variant={item.severity === "danger" ? "destructive" : "outline"}>{item.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail[language]}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{language === "vi" ? "Không có vấn đề ưu tiên cần xử lý." : "No priority issues to review."}</p>
          )}
          {healthyItems.length > 0 ? (
            <>
              <details className="rounded-xl border bg-background/50 p-3 text-sm text-muted-foreground" data-print-hidden>
                <summary className="cursor-pointer font-medium text-foreground">{healthyCopy}</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {healthyItems.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2 text-xs">
                      <span>{item.title[language]}</span>
                      <span className="text-muted-foreground">{item.detail[language]}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="rounded-xl border bg-background/50 p-3 text-sm text-muted-foreground" data-print-only>
                <div className="font-medium text-foreground">{healthyCopy}</div>
                <ul className="mt-2 flex flex-col gap-1">
                  {healthyItems.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2 text-xs">
                      <span>{item.title[language]}</span>
                      <span className="text-muted-foreground">{item.detail[language]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </>
      );
    }
    case "dailyDiagnosis": {
      if (diagnostic.daily.causes.length === 0) return null;
      return (
        <ul className="flex flex-col gap-3">
          {diagnostic.daily.causes.map((cause) => (
            <li
              key={cause.id}
              className={`flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 ${cause.severity === "danger" ? "border-destructive/30 bg-destructive/5" : "bg-background/50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-medium ${cause.severity === "danger" ? "text-destructive" : ""}`}>{cause.title[language]}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {cause.evidence.map((line) => (
                    <Badge key={line.en} variant="outline" className="tabular-nums">{line[language]}</Badge>
                  ))}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{cause.action[language]}</p>
            </li>
          ))}
        </ul>
      );
    }
    case "budgetMove": {
      if (diagnostic.engine.recommendations.length === 0) return null;
      return (
        <div className="flex flex-col gap-2">
          {diagnostic.engine.recommendations.map((recommendation) => (
            <div key={recommendation.id} className="flex flex-col gap-2 rounded-xl border bg-background/50 px-3 py-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{recommendation.summary[language]}</div>
                <Badge variant="outline" className="shrink-0 tabular-nums">{recommendation.suggestedMovePercent}%</Badge>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <div className="font-medium text-foreground">Target: {recommendation.targetRowName}</div>
                  <ul className="mt-1 flex flex-col gap-1">
                    {recommendation.targetReasons.flatMap((reason) => reason.reasons).map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-foreground">Source: {recommendation.sourceRowName}</div>
                  <ul className="mt-1 flex flex-col gap-1">
                    {recommendation.sourceReasons.flatMap((reason) => reason.reasons).map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Max target increase +{recommendation.maxIncreasePercent}%; max source reduction {recommendation.maxReductionPercent}%.
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "funnelLeakage": {
      const leakage = diagnostic.leakage;
      const stages = diagnostic.stages;
      const maxStage = Math.max(...stages.map((stage) => stage.value), 1);
      const items = leakage.blockers[language].length > 0 ? leakage.blockers[language] : [leakage.summary[language]];
      return (
        <>
          {leakage.status !== "insufficient_data" ? (
            <div className="flex flex-col gap-2 rounded-xl border bg-background/50 p-4">
              {stages.map((stage, index) => {
                const previous = index > 0 ? stages[index - 1] : null;
                const width = Math.max(8, (stage.value / maxStage) * 100);
                const drop = previous && previous.value > 0 ? 100 - (stage.value / previous.value) * 100 : 0;
                return (
                  <div key={stage.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{stage.label[language]}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US").format(stage.value)}
                        {previous ? ` · ${formatSharePct(Math.max(0, drop), currency)} ${language === "vi" ? "rơi" : "drop"}` : ""}
                        {stage.benchmark ? ` · ${language === "vi" ? "mốc" : "bench"} ${formatSharePct(stage.benchmark, currency)}` : ""}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div
                        className={`h-3 rounded-full ${index === 0 ? "bg-chart-1" : index === stages.length - 1 && leakage.status === "leakage_detected" ? "bg-destructive" : "bg-chart-2"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">{leakage.summary[language]}</div>
          )}
          <div className="rounded-xl border bg-background/50 p-4">
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </>
      );
    }
    case "creativeStarvation": {
      if (diagnostic.starvation.adsets.length === 0) return null;
      return (
        <div className="flex flex-col gap-2">
          {diagnostic.starvation.adsets.map((adset) => (
            <div key={adset.adsetId} className="flex flex-col gap-2 rounded-xl border bg-background/50 px-3 py-2.5 text-sm">
              <div className="font-semibold truncate text-xs text-muted-foreground">Ad Set: {adset.adsetName}</div>
              <div className="text-xs text-muted-foreground">{adset.reason[language]}</div>
              <div className="flex flex-col gap-1 mt-1 border-t pt-1.5">
                <span className="text-xs font-medium text-muted-foreground">Starved creatives:</span>
                {adset.starvedAds.map((ad) => (
                  <div key={ad.adId} className="flex items-center justify-between text-xs text-muted-foreground pl-2 border-l-2 border-primary/30">
                    <span className="truncate max-w-[180px]">{ad.adName}</span>
                    <span className="tabular-nums shrink-0 ml-2">{formatSharePct(ad.spendShare, currency)} spend</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "breakdownWaste": {
      return (
        <>
          {diagnostic.waste.rows.length > 0 ? (
            <div className="flex flex-col gap-2">
              {diagnostic.waste.rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border bg-background/50 px-3 py-2 text-sm">
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="text-muted-foreground tabular-nums">{formatSharePct(row.spendShare, currency)} spend</span>
                </div>
              ))}
            </div>
          ) : null}
          {diagnostic.topSegments.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">{language === "vi" ? "Phân khúc chi tiêu lớn" : "Top spend segments"}</div>
              {diagnostic.topSegments.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border bg-background/50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatSharePct(row.spendShare, currency)} {language === "vi" ? "chi tiêu" : "spend"} · {formatSharePct(row.resultShare, currency)} {language === "vi" ? "kết quả" : "results"}
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums text-muted-foreground">
                    {formatMetric(row.spend, "currency", currency)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      );
    }
    default:
      return null;
  }
}

export function DiagnosticCard({ diagnostic, language, currency, className }: { diagnostic: Diagnostic; language: InterfaceLanguage; currency: string; className?: string }) {
  const body = diagnosticCustomBody(diagnostic, language, currency);
  return (
    <div
      data-print-flow
      className={`${diagnostic.severity === "risk" ? "border-l-4 border-l-destructive " : ""}rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5${className ? ` ${className}` : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1.5">
          {diagnostic.eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{diagnostic.eyebrow[language]}</p>
          ) : null}
          <h2 className="text-xl font-semibold tracking-tight">{diagnostic.title[language]}</h2>
          <p className="text-sm text-muted-foreground">{diagnostic.description[language]}</p>
        </div>
        <Badge variant={severityBadgeVariant[diagnostic.severity]} className="shrink-0">{diagnostic.badge[language]}</Badge>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {diagnostic.summary ? (
          <p className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">{diagnostic.summary[language]}</p>
        ) : null}
        {body ?? (diagnostic.items.length > 0 ? <DiagnosticItems items={diagnostic.items} language={language} /> : null)}
        <p className="mt-1 border-t pt-2 text-xs">
          <span className="font-medium text-foreground">{language === "vi" ? "Bước tiếp theo: " : "Next step: "}</span>
          <span className="text-muted-foreground">{diagnostic.nextStep[language]}</span>
        </p>
      </div>
    </div>
  );
}
