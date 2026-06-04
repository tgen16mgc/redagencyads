import type { ChartConfig } from "@/components/ui/chart";

export const performanceChartConfig = {
  spend: { label: "Spend", color: "var(--chart-bar-spend)" },
  messages: { label: "Messages", color: "var(--chart-line-primary)" },
  replies: { label: "Replies", color: "var(--chart-line-secondary)" },
  leads: { label: "Leads", color: "var(--chart-line-primary)" },
  purchases: { label: "Purchases", color: "var(--chart-line-tertiary)" },
  linkClicks: { label: "Link clicks", color: "var(--chart-line-primary)" },
  clicks: { label: "Clicks", color: "var(--chart-line-secondary)" },
  impressions: { label: "Impressions", color: "var(--chart-line-primary)" },
  reach: { label: "Reach", color: "var(--chart-line-secondary)" },
  costPerMessage: { label: "Cost/msg", color: "var(--chart-line-diagnostic)" },
  costPerReply: { label: "Cost/reply", color: "var(--chart-line-tertiary)" },
  cpl: { label: "CPL", color: "var(--chart-line-diagnostic)" },
  cpaPurchase: { label: "CPA purchase", color: "var(--chart-line-diagnostic)" },
  cpc: { label: "CPC", color: "var(--chart-line-diagnostic)" },
  cpm: { label: "CPM", color: "var(--chart-line-tertiary)" },
  roas: { label: "ROAS", color: "var(--chart-line-secondary)" },
  ctr: { label: "CTR", color: "var(--chart-line-tertiary)" },
  frequency: { label: "Frequency", color: "var(--chart-line-diagnostic)" },
  result: { label: "Result metric", color: "var(--chart-bar-result)" },
} satisfies ChartConfig;
