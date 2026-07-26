import type { AiInsightTable, CompareMode, DashboardReport, InterfaceLanguage } from "@/lib/types";
import { buildInsightPrompt, comparisonDeltas } from "@/lib/metrics";
import { summarizeHealth } from "@/lib/health-score";
import {
  confidenceValue,
  errorMessage,
  hasNineRouterCredentials,
  nineRouterCompletion,
  parseJsonObject,
  stringArray,
  stringValue,
} from "@/lib/ai/transport";

export type GenerateInsightsInput = {
  report: DashboardReport;
  previousReport?: DashboardReport | null;
  compareMode: CompareMode;
  language?: InterfaceLanguage;
  provider?: "auto" | AiInsightTable["provider"];
};

function insightFallback(prompt: string, reason = "AI provider key not configured. Copy prompt fallback and run manually."): AiInsightTable {
  return {
    provider: "prompt",
    summary: reason,
    rows: [
      {
        area: "Setup",
        insight: "Live AI insight table unavailable.",
        evidence: `Prompt ready with ${prompt.length} chars.`,
        action: reason.includes("9router") || reason.includes("AI provider") ? "Retry with a shorter report scope or confirm the AI provider is available." : "Configure the AI provider key on the server or keep using local rules, then regenerate insights.",
        priority: "medium",
        confidence: "high",
      },
    ],
    confidence: "low",
    assumptions: [reason],
  };
}

function compactNumber(value: number, suffix = "") {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}${suffix}`;
}

function localInsightFallback(input: GenerateInsightsInput, reason: string): AiInsightTable {
  const totals = input.report.totals;
  const health = summarizeHealth(input.report);
  const failingItem = health.items.find((item) => item.severity !== "healthy");
  const topCampaign = input.report.campaignRows[0];
  const deltas = input.compareMode !== "off" && input.previousReport
    ? comparisonDeltas(input.report, input.previousReport)
    : [];
  const biggestDelta = deltas
    .filter((delta) => ["spend", "messages", "leads", "purchases", "linkClicks", "ctr", "frequency", "costPerMessage", "cpl", "roas"].includes(delta.key))
    .sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))[0];
  const rows: AiInsightTable["rows"] = [];

  if (failingItem) {
    rows.push({
      area: "Account health",
      insight: failingItem.title.en || "Health check needs attention",
      evidence: failingItem.detail.en || `Health score ${compactNumber(health.score)}/100.`,
      action: "Fix this check before scaling budget or broadening campaign scope.",
      priority: "high",
      confidence: "high",
    });
  }

  if (totals.ctr > 0 && totals.ctr < 1) {
    rows.push({
      area: "Creative",
      insight: "CTR is below the 1% benchmark.",
      evidence: `CTR is ${compactNumber(totals.ctr, "%")} on ${compactNumber(totals.impressions)} impressions.`,
      action: "Refresh hooks and first-frame creative before increasing spend.",
      priority: "high",
      confidence: "high",
    });
  }

  if (totals.frequency > 3) {
    rows.push({
      area: "Audience",
      insight: "Frequency suggests possible audience or creative fatigue.",
      evidence: `Average frequency is ${compactNumber(totals.frequency)}.`,
      action: "Rotate creative, exclude recent engagers, or widen the audience before scaling.",
      priority: totals.frequency > 5 ? "high" : "medium",
      confidence: "medium",
    });
  }

  if (topCampaign) {
    rows.push({
      area: "Budget",
      insight: `${topCampaign.name || "Top campaign"} is the first budget review target.`,
      evidence: `Spend ${compactNumber(topCampaign.spend)}, messages ${compactNumber(topCampaign.messages)}, leads ${compactNumber(topCampaign.leads)}, purchases ${compactNumber(topCampaign.purchases)}.`,
      action: "Shift budget only after checking its cost per result against the account average.",
      priority: "medium",
      confidence: "medium",
    });
  }

  if (biggestDelta) {
    rows.push({
      area: "Efficiency",
      insight: `${biggestDelta.key} changed most in the comparison window.`,
      evidence: `Change ${compactNumber(biggestDelta.change_pct ?? 0, "%")}.`,
      action: "Check which campaign or ad set caused this movement before changing budget.",
      priority: Math.abs(biggestDelta.change_pct ?? 0) >= 20 ? "high" : "medium",
      confidence: "medium",
    });
  }

  if (!rows.length) {
    rows.push({
      area: "Efficiency",
      insight: "No major red flag detected from the available Meta metrics.",
      evidence: `Spend ${compactNumber(totals.spend)}, messages ${compactNumber(totals.messages)}, leads ${compactNumber(totals.leads)}, purchases ${compactNumber(totals.purchases)}.`,
      action: "Use campaign and ad set drilldowns to pick one winner to protect and one weak segment to test.",
      priority: "medium",
      confidence: "medium",
    });
  }

  return {
    provider: "prompt",
    summary: "Live AI output was unavailable, so this brief was generated from the report metrics.",
    rows: rows.slice(0, 5),
    confidence: "medium",
    assumptions: [reason, "Fallback uses only available Meta report metrics; it does not invent CRM, Pixel, CAPI, MER, revenue, or conversion data."],
  };
}

function priorityValue(value: unknown): "low" | "medium" | "high" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function parseInsightsStrict(text: string, provider: AiInsightTable["provider"]): AiInsightTable | null {
  try {
    const json = parseJsonObject(text);
    if (!json.summary) return null;
    const rows = Array.isArray(json.rows)
      ? json.rows.map((row) => {
          const record = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
          return {
            area: stringValue(record.area, "AI output"),
            insight: stringValue(record.insight),
            evidence: stringValue(record.evidence),
            action: stringValue(record.action),
            priority: priorityValue(record.priority),
            confidence: confidenceValue(record.confidence),
          };
        }).filter((row) => row.insight || row.evidence || row.action)
      : [];
    return {
      provider,
      summary: stringValue(json.summary, "AI insight summary generated."),
      rows,
      confidence: confidenceValue(json.confidence),
      assumptions: stringArray(json.assumptions),
    };
  } catch {
    return null;
  }
}

export async function generateInsights(input: GenerateInsightsInput): Promise<AiInsightTable> {
  const prompt = buildInsightPrompt(input);
  if (input.provider === "prompt") return insightFallback(prompt);
  if (!hasNineRouterCredentials()) {
    return localInsightFallback(input, "AI provider credentials missing; local metric insights used instead.");
  }
  try {
    const text = await nineRouterCompletion(prompt, { jsonMode: true, maxTokens: 2200 });
    const parsed = parseInsightsStrict(text, "9router");
    if (!parsed) throw new Error("AI provider insights response failed JSON validation.");
    return parsed;
  } catch (error) {
    return localInsightFallback(input, `AI insights were unavailable or returned unusable output. ${errorMessage(error)}`);
  }
}
