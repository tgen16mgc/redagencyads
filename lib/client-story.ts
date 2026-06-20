import { formatMetric } from "@/lib/metrics";
import type { AiInsightTable, CompareMode, DashboardReport, InterfaceLanguage, KpiCard, NormalizedRow, Verdict } from "@/lib/types";

export type ClientStoryStatus = "On track" | "Needs attention" | "Off track";

export type ClientStoryKpi = {
  key: string;
  label: string;
  value: string;
  intent: KpiCard["intent"];
  delta?: {
    direction: "up" | "down" | "flat";
    label: string;
    value: string;
  };
};

export type ClientStoryChange = {
  label: string;
  current: string;
  previous: string;
  direction: "up" | "down" | "flat";
  summary: string;
};

export type ClientStoryAction = {
  title: string;
  reason: string;
  risk: string;
  evidence: string;
};

export type ClientStoryEvidenceGroup = {
  id: string;
  title: string;
  items: string[];
};

export type ClientStoryCause = {
  id: string;
  title: string;
  confidence: Verdict["confidence"] | AiInsightTable["confidence"] | "draft";
  evidence: string;
};

export type ClientStory = {
  reportLabel: string;
  headline: string;
  verdict: {
    status: ClientStoryStatus;
    confidence: Verdict["confidence"] | AiInsightTable["confidence"] | "draft";
    summary: string;
  };
  executiveSummary: string[];
  kpis: ClientStoryKpi[];
  whatChanged: ClientStoryChange[];
  whyItChanged: ClientStoryCause[];
  nextActions: ClientStoryAction[];
  evidenceGroups: ClientStoryEvidenceGroup[];
};

export function buildClientStory({
  report,
  previousReport,
  verdict,
  insights,
  compareMode,
  language,
}: {
  report: DashboardReport;
  previousReport: DashboardReport | null;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  compareMode: CompareMode;
  language: InterfaceLanguage;
}): ClientStory {
  const currency = report.account.currency || "VND";
  const isVietnamese = language === "vi";
  const headline = verdict?.verdict || (isVietnamese ? "Báo cáo lead generation đã sẵn sàng để khách hàng xem xét." : "Lead generation report is ready for client review.");
  const whatChanged = previousReport && compareMode !== "off" ? buildChanges(report, previousReport) : [];

  return {
    reportLabel: `${report.account.name} · ${report.dateRange.since} → ${report.dateRange.until}`,
    headline,
    verdict: {
      status: statusFromReport(report, verdict),
      confidence: verdict?.confidence || insights?.confidence || "draft",
      summary: verdict?.verdict || insights?.summary || (isVietnamese ? "Tạo Verdict để hoàn thiện câu chuyện và khuyến nghị cho khách hàng." : "Generate the Verdict to complete the client-ready narrative and recommendations."),
    },
    executiveSummary: executiveSummary({ report, verdict, insights, whatChanged, language }),
    kpis: report.kpis.slice(0, 6).map((kpi) => {
      const key = kpi.key as keyof NormalizedRow;
      const current = Number(report.totals[key] || 0);
      const previous = previousReport && compareMode !== "off" ? Number(previousReport.totals[key] || 0) : null;

      return {
        key: String(kpi.key),
        label: kpi.label,
        value: formatMetric(current, kpi.format, currency),
        intent: kpi.intent,
        delta: previous === null ? undefined : buildDelta(current, previous),
      };
    }),
    whatChanged,
    whyItChanged: buildCauses({ report, verdict, insights, language }),
    nextActions: buildActions({ verdict, insights, language }),
    evidenceGroups: buildEvidenceGroups({ report, verdict, insights, whatChanged, language }),
  };
}

function statusFromReport(report: DashboardReport, verdict: Verdict | null): ClientStoryStatus {
  if (report.health.score < 55) return "Off track";
  if (report.health.score < 80 || verdict?.risks.length) return "Needs attention";
  return "On track";
}

function executiveSummary({
  report,
  verdict,
  insights,
  whatChanged,
  language,
}: {
  report: DashboardReport;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  whatChanged: ClientStoryChange[];
  language: InterfaceLanguage;
}): string[] {
  if (language === "vi") {
    return [
      verdict?.winners[0] || `Tài khoản hiện đạt hạng sức khỏe ${report.health.grade}.`,
      whatChanged[0]?.summary || "Kéo dữ liệu kỳ so sánh để làm rõ biến động chính.",
      insights?.summary || verdict?.risks[0] || "Tạo Verdict để hoàn thiện khuyến nghị cho khách hàng.",
    ];
  }

  return [
    verdict?.winners[0] || `Account health is currently ${report.health.grade}.`,
    whatChanged[0]?.summary || "Pull a comparison period to explain the main movement.",
    insights?.summary || verdict?.risks[0] || "Generate the Verdict to complete the client recommendation.",
  ];
}

function buildDelta(current: number, previous: number): ClientStoryKpi["delta"] {
  const direction = current > previous ? "up" : current < previous ? "down" : "flat";
  const percent = previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100;
  const prefix = percent > 0 ? "+" : "";

  return {
    direction,
    label: "vs previous period",
    value: `${prefix}${percent.toFixed(1)}%`,
  };
}

function buildChanges(report: DashboardReport, previousReport: DashboardReport): ClientStoryChange[] {
  const currency = report.account.currency || "VND";
  const fields: Array<{ key: keyof NormalizedRow; label: string; format: KpiCard["format"] }> = [
    { key: "spend", label: "Spend", format: "currency" },
    { key: "leads", label: "Leads", format: "number" },
    { key: "cpl", label: "CPL", format: "currency" },
    { key: "ctr", label: "CTR", format: "percent" },
  ];

  return fields.map(({ key, label, format }) => {
    const current = Number(report.totals[key] || 0);
    const previous = Number(previousReport.totals[key] || 0);
    const direction = current > previous ? "up" : current < previous ? "down" : "flat";

    return {
      label,
      current: formatMetric(current, format, currency),
      previous: formatMetric(previous, format, currency),
      direction,
      summary: `${label} moved ${direction === "flat" ? "flat" : direction} versus the comparison period.`,
    };
  });
}

function buildCauses({
  report,
  verdict,
  insights,
  language,
}: {
  report: DashboardReport;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  language: InterfaceLanguage;
}): ClientStoryCause[] {
  const fallback = language === "vi" ? "Các kiểm tra chẩn đoán được nhóm trong phần bằng chứng." : "Diagnostic checks are grouped in the evidence section.";
  const healthCheck = report.health.checks.find((check) => check.status !== "pass");

  return [
    verdict?.losers[0]
      ? {
          id: "verdict-loser",
          title: verdict.losers[0],
          confidence: verdict.confidence,
          evidence: verdict.assumptions[0] || fallback,
        }
      : null,
    verdict?.risks[0]
      ? {
          id: "verdict-risk",
          title: verdict.risks[0],
          confidence: verdict.confidence,
          evidence: verdict.assumptions[0] || fallback,
        }
      : null,
    insights?.rows[0]
      ? {
          id: "insight-cause",
          title: insights.rows[0].insight,
          confidence: insights.rows[0].confidence,
          evidence: insights.rows[0].evidence,
        }
      : null,
    healthCheck
      ? {
          id: `health-${healthCheck.id}`,
          title: healthCheck.detail,
          confidence: "draft" as const,
          evidence: healthCheck.label,
        }
      : {
          id: "diagnostic-summary",
          title: fallback,
          confidence: "draft" as const,
          evidence: report.health.grade,
        },
  ].filter(Boolean).slice(0, 4) as ClientStoryCause[];
}

function buildActions({
  verdict,
  insights,
  language,
}: {
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  language: InterfaceLanguage;
}): ClientStoryAction[] {
  if (!verdict && !insights) {
    return [
      {
        title: language === "vi" ? "Tạo Verdict cho khách hàng" : "Generate client Verdict",
        reason: language === "vi" ? "Cần Verdict để tạo nhận định và khuyến nghị rõ ràng." : "The report needs a Verdict to produce clear narrative recommendations.",
        risk: language === "vi" ? "Chưa nên gửi báo cáo trước khi có nhận định." : "Do not send the report before the recommendation is reviewed.",
        evidence: language === "vi" ? "Dữ liệu KPI và chẩn đoán đã sẵn sàng." : "KPI and diagnostic data are ready.",
      },
    ];
  }

  const verdictActions = [...(verdict?.budget_moves || []), ...(verdict?.tests || [])];
  const insightActions = insights?.rows.map((row) => row.action) || [];

  return [...verdictActions, ...insightActions].slice(0, 4).map((action, index) => ({
    title: action,
    reason: verdict?.winners[index] || insights?.rows[index]?.insight || (language === "vi" ? "Dựa trên tín hiệu hiệu quả hiện tại." : "Based on the current performance signals."),
    risk: verdict?.risks[index] || (language === "vi" ? "Theo dõi sau khi triển khai." : "Monitor after applying the change."),
    evidence: insights?.rows[index]?.evidence || verdict?.assumptions[0] || (language === "vi" ? "Xem phần bằng chứng liên quan." : "Review the linked evidence section."),
  }));
}

function buildEvidenceGroups({
  report,
  verdict,
  insights,
  whatChanged,
  language,
}: {
  report: DashboardReport;
  verdict: Verdict | null;
  insights: AiInsightTable | null;
  whatChanged: ClientStoryChange[];
  language: InterfaceLanguage;
}): ClientStoryEvidenceGroup[] {
  const noComparison = language === "vi" ? "Chưa có kỳ so sánh." : "No comparison period loaded.";
  const noInsight = language === "vi" ? "Tạo Verdict/insights để bổ sung bằng chứng." : "Generate Verdict/insights to add more evidence.";

  return [
    {
      id: "performance-movement",
      title: language === "vi" ? "Biến động hiệu quả" : "Performance movement",
      items: whatChanged.length ? whatChanged.map((change) => change.summary) : [noComparison],
    },
    {
      id: "creative-performance",
      title: language === "vi" ? "Hiệu quả creative" : "Creative performance",
      items: [verdict?.risks[0], insights?.rows.find((row) => row.area.toLowerCase().includes("creative"))?.evidence, report.health.checks.find((check) => check.label.toLowerCase().includes("creative"))?.detail, noInsight].filter(Boolean).slice(0, 3) as string[],
    },
    {
      id: "budget-allocation",
      title: language === "vi" ? "Phân bổ ngân sách" : "Budget allocation",
      items: [verdict?.budget_moves[0], report.health.checks.find((check) => check.label.toLowerCase().includes("budget"))?.detail, noInsight].filter(Boolean).slice(0, 3) as string[],
    },
    {
      id: "measurement-confidence",
      title: language === "vi" ? "Độ tin cậy đo lường" : "Measurement confidence",
      items: [report.health.checks.find((check) => check.label.toLowerCase().includes("measurement"))?.detail, verdict?.assumptions[0], noInsight].filter(Boolean).slice(0, 3) as string[],
    },
  ];
}
