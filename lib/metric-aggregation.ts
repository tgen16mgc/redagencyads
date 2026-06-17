import type { NormalizedRow } from "@/lib/types";

const ZERO_ROW: Omit<NormalizedRow, "id" | "level" | "name"> = {
  spend: 0,
  impressions: 0,
  reach: 0,
  frequency: 0,
  clicks: 0,
  linkClicks: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  messages: 0,
  replies: 0,
  leads: 0,
  purchases: 0,
  addToCart: 0,
  initiateCheckout: 0,
  costPerMessage: 0,
  costPerReply: 0,
  cpl: 0,
  cpaPurchase: 0,
  roas: 0,
  replyRate: 0,
  leadRate: 0,
};

const safeDivide = (top: number, bottom: number) => (bottom ? top / bottom : 0);

export function sumRows(rows: NormalizedRow[], name: string): NormalizedRow {
  const total = rows.reduce<NormalizedRow>(
    (sum, row) => ({
      ...sum,
      spend: sum.spend + row.spend,
      impressions: sum.impressions + row.impressions,
      reach: sum.reach + row.reach,
      clicks: sum.clicks + row.clicks,
      linkClicks: sum.linkClicks + row.linkClicks,
      messages: sum.messages + row.messages,
      replies: sum.replies + row.replies,
      leads: sum.leads + row.leads,
      purchases: sum.purchases + row.purchases,
      addToCart: sum.addToCart + row.addToCart,
      initiateCheckout: sum.initiateCheckout + row.initiateCheckout,
    }),
    { ...ZERO_ROW, id: "total", level: "account", name },
  );
  total.ctr = safeDivide(total.clicks, total.impressions) * 100;
  total.cpc = safeDivide(total.spend, total.clicks);
  total.cpm = safeDivide(total.spend, total.impressions) * 1000;
  total.frequency = safeDivide(total.impressions, total.reach);
  total.costPerMessage = safeDivide(total.spend, total.messages);
  total.costPerReply = safeDivide(total.spend, total.replies);
  total.cpl = safeDivide(total.spend, total.leads);
  total.cpaPurchase = safeDivide(total.spend, total.purchases);
  total.replyRate = safeDivide(total.replies, total.messages) * 100;
  total.leadRate = safeDivide(total.leads, total.messages) * 100;
  const roasSpend = rows.reduce((sum, row) => sum + (row.roas > 0 ? row.spend : 0), 0);
  total.roas = safeDivide(rows.reduce((sum, row) => sum + row.roas * row.spend, 0), roasSpend);
  return total;
}
