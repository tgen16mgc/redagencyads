import type { AiInsightTable } from "@/lib/types";
import {
  confidenceValue,
  errorMessage,
  hasNineRouterCredentials,
  nineRouterCompletion,
  parseJsonObject,
  promptInputJson,
  stringArray,
  stringValue,
} from "@/lib/ai/transport";

function insightFallback(prompt: string, reason = "AI provider key not configured. Copy prompt fallback and run manually."): AiInsightTable {
  return {
    provider: "prompt",
    summary: reason,
    rows: [
      {
        area: "Setup",
        insight: "Live AI insight table unavailable.",
        evidence: `Prompt ready with ${prompt.length} chars.`,
        action: reason.includes("9router") ? "Retry with a shorter report scope or confirm 9router is running." : "Add NINEROUTER_KEY on server or keep using local rules, then regenerate insights.",
        priority: "medium",
        confidence: "high",
      },
    ],
    confidence: "low",
    assumptions: [reason],
  };
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value || 0) || 0;
}

function compactNumber(value: number, suffix = "") {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}${suffix}`;
}

function localInsightFallback(prompt: string, reason: string): AiInsightTable {
  const input = promptInputJson(prompt);
  if (!input) return insightFallback(prompt, reason);

  const totals = typeof input.totals === "object" && input.totals !== null ? (input.totals as Record<string, unknown>) : {};
  const health = typeof input.health === "object" && input.health !== null ? (input.health as Record<string, unknown>) : {};
  const checks = Array.isArray(health.checks) ? health.checks : [];
  const rows: AiInsightTable["rows"] = [];
  const failingCheck = checks.find((check) => typeof check === "object" && check !== null && (check as Record<string, unknown>).status !== "pass") as Record<string, unknown> | undefined;
  const topCampaign = Array.isArray(input.top_campaigns) ? input.top_campaigns[0] as Record<string, unknown> | undefined : undefined;
  const comparison = typeof input.comparison === "object" && input.comparison !== null ? (input.comparison as Record<string, unknown>) : null;
  const deltas = comparison && Array.isArray(comparison.deltas) ? comparison.deltas as Record<string, unknown>[] : [];
  const biggestDelta = deltas
    .filter((delta) => ["spend", "messages", "leads", "purchases", "linkClicks", "ctr", "frequency", "costPerMessage", "cpl", "roas"].includes(stringValue(delta.key)))
    .sort((a, b) => Math.abs(numberValue(b.change_pct)) - Math.abs(numberValue(a.change_pct)))[0];
  const ctr = numberValue(totals.ctr);
  const frequency = numberValue(totals.frequency);
  const spend = numberValue(totals.spend);
  const messages = numberValue(totals.messages);
  const leads = numberValue(totals.leads);
  const purchases = numberValue(totals.purchases);

  if (failingCheck) {
    rows.push({
      area: "Account health",
      insight: stringValue(failingCheck.label, "Health check needs attention"),
      evidence: stringValue(failingCheck.detail, `Health score ${compactNumber(numberValue(health.score))}/100.`),
      action: "Fix this check before scaling budget or broadening campaign scope.",
      priority: "high",
      confidence: "high",
    });
  }

  if (ctr > 0 && ctr < 1) {
    rows.push({
      area: "Creative",
      insight: "CTR is below the 1% benchmark.",
      evidence: `CTR is ${compactNumber(ctr, "%")} on ${compactNumber(numberValue(totals.impressions))} impressions.`,
      action: "Refresh hooks and first-frame creative before increasing spend.",
      priority: "high",
      confidence: "high",
    });
  }

  if (frequency > 3) {
    rows.push({
      area: "Audience",
      insight: "Frequency suggests possible audience or creative fatigue.",
      evidence: `Average frequency is ${compactNumber(frequency)}.`,
      action: "Rotate creative, exclude recent engagers, or widen the audience before scaling.",
      priority: frequency > 5 ? "high" : "medium",
      confidence: "medium",
    });
  }

  if (topCampaign) {
    rows.push({
      area: "Budget",
      insight: `${stringValue(topCampaign.name, "Top campaign")} is the first budget review target.`,
      evidence: `Spend ${compactNumber(numberValue(topCampaign.spend))}, messages ${compactNumber(numberValue(topCampaign.messages))}, leads ${compactNumber(numberValue(topCampaign.leads))}, purchases ${compactNumber(numberValue(topCampaign.purchases))}.`,
      action: "Shift budget only after checking its cost per result against the account average.",
      priority: "medium",
      confidence: "medium",
    });
  }

  if (biggestDelta) {
    rows.push({
      area: "Efficiency",
      insight: `${stringValue(biggestDelta.key, "Metric")} changed most in the comparison window.`,
      evidence: `Change ${compactNumber(numberValue(biggestDelta.change_pct), "%")}.`,
      action: "Check which campaign or ad set caused this movement before changing budget.",
      priority: Math.abs(numberValue(biggestDelta.change_pct)) >= 20 ? "high" : "medium",
      confidence: "medium",
    });
  }

  if (!rows.length) {
    rows.push({
      area: "Efficiency",
      insight: "No major red flag detected from the available Meta metrics.",
      evidence: `Spend ${compactNumber(spend)}, messages ${compactNumber(messages)}, leads ${compactNumber(leads)}, purchases ${compactNumber(purchases)}.`,
      action: "Use campaign and ad set drilldowns to pick one winner to protect and one weak segment to test.",
      priority: "medium",
      confidence: "medium",
    });
  }

  return {
    provider: "prompt",
    summary: "Live OpenRouter output was unavailable, so this brief was generated from the report metrics.",
    rows: rows.slice(0, 5),
    confidence: "medium",
    assumptions: [reason, "Fallback uses only available Meta report metrics; it does not invent CRM, Pixel, CAPI, MER, revenue, or conversion data."],
  };
}

function priorityValue(value: unknown): "low" | "medium" | "high" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function parseInsights(text: string, provider: AiInsightTable["provider"]): AiInsightTable {
  try {
    const json = parseJsonObject(text);
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
    return {
      provider,
      summary: "Model returned non-JSON output.",
      rows: [
        {
          area: "AI output",
          insight: text.slice(0, 180),
          evidence: "JSON parsing failed.",
          action: "Retry or use prompt fallback.",
          priority: "medium",
          confidence: "low",
        },
      ],
      confidence: "low",
      assumptions: ["Raw model output truncated into insight row."],
    };
  }
}

export async function generateInsights(prompt: string, provider: "auto" | AiInsightTable["provider"]) {
  if (provider === "prompt") return insightFallback(prompt);
  if ((provider === "9router" || provider === "auto") && hasNineRouterCredentials()) {
    try {
      return parseInsights(await nineRouterCompletion(prompt, { jsonMode: true, maxTokens: 2200 }), "9router");
    } catch (error) {
      return localInsightFallback(prompt, `9router insights were unavailable or returned unusable output. ${errorMessage(error)}`);
    }
  }
  return localInsightFallback(prompt, "9router credentials missing; local metric insights used instead.");
}
