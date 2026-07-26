import type { KpiPack, NormalizedRow } from "@/lib/types";

export type PrimaryResultKey = "messages" | "leads" | "purchases" | "linkClicks";
export type PrimaryCostKey = "costPerMessage" | "cpl" | "cpaPurchase" | "cpc";
export type SignalVolumeKey = PrimaryResultKey | "reach";

export type PrimaryResultSpec = {
  resultKey: PrimaryResultKey | null;
  costKey: PrimaryCostKey | null;
  volumeKey: SignalVolumeKey;
  resultLabel: { en: string; vi: string };
  costLabel: { en: string; vi: string };
  volumeLabel: { en: string; vi: string };
};

const specs: Record<KpiPack, PrimaryResultSpec> = {
  messages: {
    resultKey: "messages",
    costKey: "costPerMessage",
    volumeKey: "messages",
    resultLabel: { en: "messages", vi: "tin nhắn" },
    costLabel: { en: "cost/message", vi: "cost/message" },
    volumeLabel: { en: "messages", vi: "tin nhắn" },
  },
  lead_gen: {
    resultKey: "leads",
    costKey: "cpl",
    volumeKey: "leads",
    resultLabel: { en: "leads", vi: "lead" },
    costLabel: { en: "CPL", vi: "CPL" },
    volumeLabel: { en: "leads", vi: "lead" },
  },
  sales_roas: {
    resultKey: "purchases",
    costKey: "cpaPurchase",
    volumeKey: "purchases",
    resultLabel: { en: "purchases", vi: "đơn mua" },
    costLabel: { en: "CPA", vi: "CPA" },
    volumeLabel: { en: "purchases", vi: "đơn mua" },
  },
  traffic: {
    resultKey: "linkClicks",
    costKey: "cpc",
    volumeKey: "linkClicks",
    resultLabel: { en: "link clicks", vi: "link click" },
    costLabel: { en: "CPC", vi: "CPC" },
    volumeLabel: { en: "link clicks", vi: "link click" },
  },
  awareness: {
    resultKey: null,
    costKey: null,
    volumeKey: "reach",
    resultLabel: { en: "delivery/creative efficiency", vi: "delivery/creative efficiency" },
    costLabel: { en: "CTR/CPM/frequency", vi: "CTR/CPM/frequency" },
    volumeLabel: { en: "reach", vi: "tiếp cận" },
  },
};

export function primaryResultSpec(pack: KpiPack): PrimaryResultSpec {
  return specs[pack];
}

export function primaryResultValue(row: NormalizedRow, pack: KpiPack): number {
  const key = specs[pack].resultKey;
  return key ? Number(row[key] || 0) : 0;
}

export function signalVolumeValue(row: NormalizedRow, pack: KpiPack): number {
  return Number(row[specs[pack].volumeKey] || 0);
}
