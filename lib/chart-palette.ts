import type { ChartConfig } from "@/components/ui/chart";

export const performanceChartConfig = {
  spend: { label: "Spend", color: "var(--chart-1)" },
  messages: { label: "Messages", color: "var(--chart-2)" },
  replies: { label: "Replies", color: "var(--chart-3)" },
  leads: { label: "Leads", color: "var(--chart-2)" },
  purchases: { label: "Purchases", color: "var(--chart-3)" },
  linkClicks: { label: "Link clicks", color: "var(--chart-2)" },
  clicks: { label: "Clicks", color: "var(--chart-3)" },
  impressions: { label: "Impressions", color: "var(--chart-2)" },
  reach: { label: "Reach", color: "var(--chart-3)" },
  costPerMessage: { label: "Cost/msg", color: "var(--chart-1)" },
  costPerReply: { label: "Cost/reply", color: "var(--chart-2)" },
  cpl: { label: "CPL", color: "var(--chart-1)" },
  cpaPurchase: { label: "CPA purchase", color: "var(--chart-1)" },
  cpc: { label: "CPC", color: "var(--chart-1)" },
  cpm: { label: "CPM", color: "var(--chart-2)" },
  roas: { label: "ROAS", color: "var(--chart-2)" },
  ctr: { label: "CTR", color: "var(--chart-2)" },
  frequency: { label: "Frequency", color: "var(--chart-1)" },
  result: { label: "Result metric", color: "var(--chart-2)" },
} satisfies ChartConfig;
