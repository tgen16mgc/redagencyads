import { buildPrompt, detectKpiPack, getKpiCards, scoreHealth, sumRows } from "@/lib/metrics";
import type { DashboardReport, MetaAccount, MetaCampaign, NormalizedRow } from "@/lib/types";

export const SAMPLE_ACCOUNT: MetaAccount = {
  id: "act_sample_demo",
  name: "Aura Beauty Clinic — Sample",
  account_id: "000000000000000",
  currency: "VND",
  timezone_name: "Asia/Ho_Chi_Minh",
};

export const SAMPLE_CAMPAIGNS: MetaCampaign[] = [
  { id: "smp-c1", name: "Lead | Facial Combo — Advantage+", objective: "OUTCOME_LEADS", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "1500000" },
  { id: "smp-c2", name: "Lead | Acne Treatment — Interests", objective: "OUTCOME_LEADS", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "800000" },
  { id: "smp-c3", name: "Message | Zalo Consults", objective: "OUTCOME_ENGAGEMENT", status: "ACTIVE", effective_status: "ACTIVE", daily_budget: "500000" },
];

type RowBase = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  messages?: number;
  replies?: number;
  leads?: number;
  purchases?: number;
};

type AdSeed = RowBase & {
  adId: string;
  adName: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
};

const AD_SEEDS: AdSeed[] = [
  { adId: "smp-ad-111", adName: "Video • Trước/sau liệu trình", adsetId: "smp-as-11", adsetName: "LAL 3% HCM — nữ 25-45", campaignId: "smp-c1", campaignName: "Lead | Facial Combo — Advantage+", spend: 5_400_000, impressions: 250_000, reach: 118_000, clicks: 5_900, linkClicks: 4_600, leads: 19, messages: 3, replies: 2 },
  { adId: "smp-ad-112", adName: "Carousel • Combo 5 buổi", adsetId: "smp-as-11", adsetName: "LAL 3% HCM — nữ 25-45", campaignId: "smp-c1", campaignName: "Lead | Facial Combo — Advantage+", spend: 4_100_000, impressions: 205_000, reach: 101_000, clicks: 3_900, linkClicks: 3_000, leads: 12 },
  { adId: "smp-ad-121", adName: "Video • Review khách hàng", adsetId: "smp-as-12", adsetName: "Broad — nữ 22-45", campaignId: "smp-c1", campaignName: "Lead | Facial Combo — Advantage+", spend: 5_200_000, impressions: 268_000, reach: 121_000, clicks: 3_600, linkClicks: 2_600, leads: 15 },
  { adId: "smp-ad-122", adName: "Ảnh • Ưu đãi tháng 7", adsetId: "smp-as-12", adsetName: "Broad — nữ 22-45", campaignId: "smp-c1", campaignName: "Lead | Facial Combo — Advantage+", spend: 3_800_000, impressions: 197_000, reach: 90_000, clicks: 2_200, linkClicks: 1_700, leads: 6 },
  { adId: "smp-ad-211", adName: "Video • Quy trình điều trị", adsetId: "smp-as-21", adsetName: "Interest — skincare & spa", campaignId: "smp-c2", campaignName: "Lead | Acne Treatment — Interests", spend: 5_600_000, impressions: 340_000, reach: 172_000, clicks: 3_700, linkClicks: 2_800, leads: 9 },
  { adId: "smp-ad-221", adName: "Ảnh • Nhắc lịch tư vấn", adsetId: "smp-as-22", adsetName: "Retarget 30 ngày", campaignId: "smp-c2", campaignName: "Lead | Acne Treatment — Interests", spend: 4_200_000, impressions: 270_000, reach: 75_000, clicks: 1_900, linkClicks: 1_500, leads: 5 },
  { adId: "smp-ad-311", adName: "Video • Tư vấn da 1:1", adsetId: "smp-as-31", adsetName: "Zalo — TP.HCM", campaignId: "smp-c3", campaignName: "Message | Zalo Consults", spend: 3_400_000, impressions: 190_000, reach: 106_000, clicks: 2_900, linkClicks: 1_850, messages: 118, replies: 96, leads: 4 },
  { adId: "smp-ad-321", adName: "Ảnh • Đặt lịch nhanh", adsetId: "smp-as-32", adsetName: "Zalo — Hà Nội", campaignId: "smp-c3", campaignName: "Message | Zalo Consults", spend: 2_800_000, impressions: 160_000, reach: 89_000, clicks: 2_300, linkClicks: 1_450, messages: 92, replies: 72, leads: 2 },
];

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function makeRow(
  level: NormalizedRow["level"],
  identity: Partial<NormalizedRow> & { id: string; name: string },
  base: RowBase,
): NormalizedRow {
  const messages = base.messages || 0;
  const replies = base.replies || 0;
  const leads = base.leads || 0;
  const purchases = base.purchases || 0;
  return {
    level,
    campaignId: undefined,
    campaignName: undefined,
    adsetId: undefined,
    adsetName: undefined,
    adId: undefined,
    adName: undefined,
    date: undefined,
    platform: undefined,
    placement: undefined,
    age: undefined,
    gender: undefined,
    region: undefined,
    country: undefined,
    ...identity,
    spend: base.spend,
    impressions: base.impressions,
    reach: base.reach,
    frequency: Number(safeDivide(base.impressions, base.reach).toFixed(2)),
    clicks: base.clicks,
    linkClicks: base.linkClicks,
    ctr: Number((safeDivide(base.clicks, base.impressions) * 100).toFixed(2)),
    cpc: Math.round(safeDivide(base.spend, base.clicks)),
    cpm: Math.round(safeDivide(base.spend, base.impressions) * 1000),
    messages,
    replies,
    leads,
    purchases,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: Math.round(safeDivide(base.spend, messages)),
    costPerReply: Math.round(safeDivide(base.spend, replies)),
    cpl: Math.round(safeDivide(base.spend, leads)),
    cpaPurchase: Math.round(safeDivide(base.spend, purchases)),
    roas: 0,
    replyRate: Number((safeDivide(replies, messages) * 100).toFixed(1)),
    leadRate: Number((safeDivide(leads, messages) * 100).toFixed(1)),
  };
}

function sumBases(seeds: RowBase[]): RowBase {
  return seeds.reduce<RowBase>(
    (acc, seed) => ({
      spend: acc.spend + seed.spend,
      impressions: acc.impressions + seed.impressions,
      reach: acc.reach + seed.reach,
      clicks: acc.clicks + seed.clicks,
      linkClicks: acc.linkClicks + seed.linkClicks,
      messages: (acc.messages || 0) + (seed.messages || 0),
      replies: (acc.replies || 0) + (seed.replies || 0),
      leads: (acc.leads || 0) + (seed.leads || 0),
      purchases: (acc.purchases || 0) + (seed.purchases || 0),
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, messages: 0, replies: 0, leads: 0, purchases: 0 },
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = map.get(key(item)) || [];
    bucket.push(item);
    map.set(key(item), bucket);
  }
  return map;
}

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const DAY_COUNT = 14;

function buildDailyRows(accountTotal: RowBase): NormalizedRow[] {
  const weights = [0.9, 1.0, 1.05, 1.1, 1.0, 0.8, 0.75, 0.95, 1.05, 1.35, 1.25, 1.0, 0.9, 0.9];
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight, index) => {
    const share = weight / weightSum;
    const dip = index === 9 ? 0.45 : 1;
    return makeRow(
      "daily",
      { id: `smp-day-${index}`, name: isoDaysAgo(DAY_COUNT - 1 - index), date: isoDaysAgo(DAY_COUNT - 1 - index) },
      {
        spend: Math.round(accountTotal.spend * share),
        impressions: Math.round(accountTotal.impressions * share),
        reach: Math.round((accountTotal.reach / DAY_COUNT) * weight * 2.2),
        clicks: Math.round(accountTotal.clicks * share),
        linkClicks: Math.round(accountTotal.linkClicks * share),
        messages: Math.round((accountTotal.messages || 0) * share),
        replies: Math.round((accountTotal.replies || 0) * share),
        leads: Math.max(0, Math.round((accountTotal.leads || 0) * share * dip)),
      },
    );
  });
}

export function buildSampleReport(): DashboardReport {
  const adRows = AD_SEEDS.map((seed) =>
    makeRow("ad", {
      id: seed.adId,
      name: seed.adName,
      adId: seed.adId,
      adName: seed.adName,
      adsetId: seed.adsetId,
      adsetName: seed.adsetName,
      campaignId: seed.campaignId,
      campaignName: seed.campaignName,
    }, seed),
  );

  const adsetRows = [...groupBy(AD_SEEDS, (seed) => seed.adsetId).entries()].map(([adsetId, seeds]) =>
    makeRow("adset", {
      id: adsetId,
      name: seeds[0].adsetName,
      adsetId,
      adsetName: seeds[0].adsetName,
      campaignId: seeds[0].campaignId,
      campaignName: seeds[0].campaignName,
    }, sumBases(seeds)),
  );

  const campaignRows = [...groupBy(AD_SEEDS, (seed) => seed.campaignId).entries()].map(([campaignId, seeds]) =>
    makeRow("campaign", {
      id: campaignId,
      name: seeds[0].campaignName,
      campaignId,
      campaignName: seeds[0].campaignName,
    }, sumBases(seeds)),
  );

  const accountTotal = sumBases(AD_SEEDS);
  const share = (fraction: number): RowBase => ({
    spend: Math.round(accountTotal.spend * fraction),
    impressions: Math.round(accountTotal.impressions * fraction),
    reach: Math.round(accountTotal.reach * fraction),
    clicks: Math.round(accountTotal.clicks * fraction),
    linkClicks: Math.round(accountTotal.linkClicks * fraction),
    messages: Math.round((accountTotal.messages || 0) * fraction),
    replies: Math.round((accountTotal.replies || 0) * fraction),
    leads: Math.round((accountTotal.leads || 0) * fraction),
  });

  const platformRows = [
    makeRow("breakdown", { id: "smp-pf-fb", name: "facebook", platform: "facebook" }, share(0.55)),
    makeRow("breakdown", { id: "smp-pf-ig", name: "instagram", platform: "instagram" }, share(0.38)),
    makeRow("breakdown", { id: "smp-pf-an", name: "audience_network", platform: "audience_network" }, share(0.07)),
  ];

  const ageGenderRows = [
    makeRow("breakdown", { id: "smp-ag-1", name: "18-24 · nữ", age: "18-24", gender: "female" }, share(0.16)),
    makeRow("breakdown", { id: "smp-ag-2", name: "25-34 · nữ", age: "25-34", gender: "female" }, share(0.34)),
    makeRow("breakdown", { id: "smp-ag-3", name: "35-44 · nữ", age: "35-44", gender: "female" }, share(0.24)),
    makeRow("breakdown", { id: "smp-ag-4", name: "18-24 · nam", age: "18-24", gender: "male" }, share(0.07)),
    makeRow("breakdown", { id: "smp-ag-5", name: "25-34 · nam", age: "25-34", gender: "male" }, share(0.12)),
    makeRow("breakdown", { id: "smp-ag-6", name: "35-44 · nam", age: "35-44", gender: "male" }, share(0.07)),
  ];

  const regionRows = [
    makeRow("breakdown", { id: "smp-rg-1", name: "TP. Hồ Chí Minh", region: "TP. Hồ Chí Minh" }, share(0.45)),
    makeRow("breakdown", { id: "smp-rg-2", name: "Hà Nội", region: "Hà Nội" }, share(0.3)),
    makeRow("breakdown", { id: "smp-rg-3", name: "Đà Nẵng", region: "Đà Nẵng" }, share(0.1)),
    makeRow("breakdown", { id: "smp-rg-4", name: "Cần Thơ", region: "Cần Thơ" }, share(0.08)),
    makeRow("breakdown", { id: "smp-rg-5", name: "Khác", region: "Khác" }, share(0.07)),
  ];

  const dailyRows = buildDailyRows(accountTotal);
  const totals = sumRows(campaignRows, "Account total");
  const detected = detectKpiPack(SAMPLE_CAMPAIGNS, campaignRows, adsetRows);
  const health = scoreHealth({ totals, campaignRows, adsetRows, adRows });
  const dateRange = { since: isoDaysAgo(DAY_COUNT - 1), until: isoDaysAgo(0) };
  const prompt = buildPrompt({
    account: SAMPLE_ACCOUNT,
    campaigns: SAMPLE_CAMPAIGNS,
    selectedPack: detected.pack,
    totals,
    campaignRows,
    adsetRows,
    adRows,
    dailyRows,
    platformRows,
    ageGenderRows,
    regionRows,
    health,
    dateRange,
  });

  return {
    source: "sample",
    account: SAMPLE_ACCOUNT,
    selectedCampaigns: SAMPLE_CAMPAIGNS,
    dateRange,
    detectedPack: detected.pack,
    selectedPack: detected.pack,
    packReason: detected.reason,
    kpis: getKpiCards(detected.pack),
    totals,
    campaignRows,
    adsetRows,
    adRows,
    dailyRows,
    platformRows,
    ageGenderRows,
    regionRows,
    health,
    prompt,
    pulledAt: new Date().toISOString(),
  };
}
