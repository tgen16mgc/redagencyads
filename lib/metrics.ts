import { sumRows } from "@/lib/metric-aggregation";
import type { CompareMode, CompetitorPlatform, CompetitorSpyAd, DashboardReport, InsightAction, InsightRow, KpiCard, KpiPack, MetaAccount, MetaCampaign, NormalizedRow } from "@/lib/types";
import { compareTotals } from "@/lib/metric-comparison";

export { sumRows } from "@/lib/metric-aggregation";

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

const actionValue = (items: InsightAction[] | undefined, types: string[]) =>
  Number(items?.find((item) => types.includes(item.action_type))?.value || 0);

const costValue = (items: InsightAction[] | undefined, types: string[]) =>
  Number(items?.find((item) => types.includes(item.action_type))?.value || 0);

const safeDivide = (top: number, bottom: number) => (bottom ? top / bottom : 0);

function roasValue(row: InsightRow) {
  const purchase = Number(row.purchase_roas?.[0]?.value || 0);
  const website = Number(row.website_purchase_roas?.[0]?.value || 0);
  return purchase || website || 0;
}

export function normalizeRows(rows: InsightRow[], level: NormalizedRow["level"]): NormalizedRow[] {
  return rows.map((row, index) => {
    const spend = Number(row.spend || 0);
    const messages = actionValue(row.actions, [
      "onsite_conversion.total_messaging_connection",
      "onsite_conversion.messaging_conversation_started_7d",
      "messaging_conversation_started_7d",
    ]);
    const replies = actionValue(row.actions, [
      "onsite_conversion.messaging_conversation_replied_7d",
      "onsite_conversion.messaging_first_reply",
    ]);
    const leads = actionValue(row.actions, ["lead", "onsite_conversion.lead_grouped"]);
    const purchases = actionValue(row.actions, ["purchase", "omni_purchase"]);
    const normalized: NormalizedRow = {
      ...ZERO_ROW,
      id: row.ad_id || row.adset_id || row.campaign_id || `${level}-${index}`,
      level,
      name: row.ad_name || row.adset_name || row.campaign_name || row.publisher_platform || row.region || row.country || row.date_start || "Account total",
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      adsetId: row.adset_id,
      adsetName: row.adset_name,
      adId: row.ad_id,
      adName: row.ad_name,
      date: row.date_start,
      platform: row.publisher_platform,
      placement: row.platform_position,
      age: row.age,
      gender: row.gender,
      region: row.region,
      country: row.country,
      spend,
      impressions: Number(row.impressions || 0),
      reach: Number(row.reach || 0),
      frequency: Number(row.frequency || 0),
      clicks: Number(row.clicks || 0),
      linkClicks: Number(row.inline_link_clicks || actionValue(row.actions, ["link_click"])),
      ctr: Number(row.ctr || 0),
      cpc: Number(row.cpc || 0),
      cpm: Number(row.cpm || 0),
      messages,
      replies,
      leads,
      purchases,
      addToCart: actionValue(row.actions, ["add_to_cart", "omni_add_to_cart"]),
      initiateCheckout: actionValue(row.actions, ["initiate_checkout", "omni_initiated_checkout"]),
      costPerMessage:
        costValue(row.cost_per_action_type, ["onsite_conversion.total_messaging_connection"]) ||
        safeDivide(spend, messages),
      costPerReply:
        costValue(row.cost_per_action_type, ["onsite_conversion.messaging_conversation_replied_7d"]) ||
        safeDivide(spend, replies),
      cpl: costValue(row.cost_per_action_type, ["lead", "onsite_conversion.lead_grouped"]) || safeDivide(spend, leads),
      cpaPurchase: costValue(row.cost_per_action_type, ["purchase", "omni_purchase"]) || safeDivide(spend, purchases),
      roas: roasValue(row),
      replyRate: safeDivide(replies, messages) * 100,
      leadRate: safeDivide(leads, messages) * 100,
    };
    return normalized;
  });
}

export function detectKpiPack(campaigns: MetaCampaign[], campaignRows: NormalizedRow[], adsetRows: NormalizedRow[]) {
  const text = campaigns.map((campaign) => `${campaign.objective || ""} ${campaign.name}`).join(" ").toLowerCase();
  const totals = sumRows([...campaignRows, ...adsetRows], "detection");
  if (/message|mess|inbox|chat/.test(text) || totals.messages > totals.leads * 2) {
    return { pack: "messages" as KpiPack, reason: "Campaign name/objective/actions indicate message or inbox optimization." };
  }
  if (/lead|form|demo|booking/.test(text) || totals.leads > 0) {
    return { pack: "lead_gen" as KpiPack, reason: "Lead actions detected or campaign naming indicates lead generation." };
  }
  if (/sale|purchase|conversion|shop|catalog|roas/.test(text) || totals.purchases > 0 || totals.roas > 0) {
    return { pack: "sales_roas" as KpiPack, reason: "Sales objective, purchase actions, or ROAS data detected." };
  }
  if (/traffic|click|landing/.test(text) || totals.linkClicks > 0) {
    return { pack: "traffic" as KpiPack, reason: "Traffic/click signal is strongest available optimization signal." };
  }
  return { pack: "awareness" as KpiPack, reason: "No lower-funnel conversion signal found; defaulting to delivery/awareness metrics." };
}

export function getKpiCards(pack: KpiPack): KpiCard[] {
  const common: KpiCard[] = [
    { key: "impressions", label: "Impressions", format: "number" },
    { key: "reach", label: "Reach", format: "number" },
  ];
  const packs: Record<KpiPack, KpiCard[]> = {
    messages: [
      ...common,
      { key: "messages", label: "Messages", format: "number", intent: "good" },
      { key: "costPerMessage", label: "Cost/message", format: "currency" },
      { key: "replyRate", label: "Reply rate", format: "percent" },
    ],
    lead_gen: [
      ...common,
      { key: "leads", label: "Leads", format: "number", intent: "good" },
      { key: "cpl", label: "CPL", format: "currency" },
      { key: "leadRate", label: "Lead/message", format: "percent" },
    ],
    sales_roas: [
      ...common,
      { key: "purchases", label: "Purchases", format: "number", intent: "good" },
      { key: "cpaPurchase", label: "CPA", format: "currency" },
      { key: "roas", label: "ROAS", format: "ratio" },
    ],
    traffic: [
      ...common,
      { key: "linkClicks", label: "Link clicks", format: "number", intent: "good" },
      { key: "ctr", label: "CTR", format: "percent" },
      { key: "cpc", label: "CPC", format: "currency" },
    ],
    awareness: [
      ...common,
      { key: "frequency", label: "Frequency", format: "number" },
      { key: "cpm", label: "CPM", format: "currency" },
      { key: "ctr", label: "CTR", format: "percent" },
    ],
  };
  return packs[pack];
}

export function scoreHealth(args: {
  totals: NormalizedRow;
  campaignRows: NormalizedRow[];
  adsetRows: NormalizedRow[];
  adRows: NormalizedRow[];
  pack?: KpiPack;
}) {
  type CheckStatus = "pass" | "warning" | "fail";

  // Pack-aware CTR thresholds (pass / warning floor)
  const ctrThresholds: Record<KpiPack, { pass: number; warn: number }> = {
    traffic:    { pass: 1.5, warn: 0.9 },
    lead_gen:   { pass: 1.0, warn: 0.5 },
    sales_roas: { pass: 0.9, warn: 0.5 },
    messages:   { pass: 0.8, warn: 0.4 },
    awareness:  { pass: 0.4, warn: 0.3 },
  };
  const ctrT = ctrThresholds[args.pack ?? "lead_gen"];
  const ctrStatus = (args.totals.ctr >= ctrT.pass ? "pass" : args.totals.ctr >= ctrT.warn ? "warning" : "fail") as CheckStatus;

  const checks = [
    {
      id: "M-CR4",
      label: "CTR benchmark",
      status: ctrStatus,
      detail: `CTR ${args.totals.ctr.toFixed(2)}%. Pack benchmark pass >= ${ctrT.pass}%.`,
    },
    {
      id: "M-CR2",
      label: "Prospecting frequency",
      status: (args.totals.frequency < 3 ? "pass" : args.totals.frequency <= 5 ? "warning" : "fail") as CheckStatus,
      detail: `Average frequency ${args.totals.frequency.toFixed(2)}.`,
    },
    {
      id: "M25",
      label: "Creative/ad volume proxy",
      status: (args.adRows.length >= 10 ? "pass" : args.adRows.length >= 3 ? "warning" : "fail") as CheckStatus,
      detail: `${args.adRows.length} ads found in selected scope. Target: 10+ diverse creatives where budget supports it.`,
    },
    {
      id: "M11",
      label: "Campaign consolidation",
      status: (args.campaignRows.length <= 3 ? "pass" : args.campaignRows.length <= 5 ? "warning" : "fail") as CheckStatus,
      detail: `${args.campaignRows.length} selected campaigns. Meta prefers fewer campaigns per goal.`,
    },
  ];
  const weights: Record<string, { pass: number; warning: number; fail: number }> = {
    "M-CR4": { pass: 30, warning: 17, fail: 5 },
    "M-CR2": { pass: 30, warning: 17, fail: 5 },
    "M25":   { pass: 20, warning: 11, fail: 3 },
    "M11":   { pass: 20, warning: 11, fail: 3 },
  };
  const points = checks.reduce((sum, check) => {
    const w = weights[check.id] ?? { pass: 25, warning: 14, fail: 4 };
    return sum + (check.status === "pass" ? w.pass : check.status === "warning" ? w.warning : w.fail);
  }, 0);
  const grade = points >= 90 ? "A" : points >= 75 ? "B" : points >= 60 ? "C" : points >= 40 ? "D" : "F";
  return { score: points, grade, checks };
}

function metricLocale(currency = "VND") {
  return currency === "VND" ? "vi-VN" : "en-US";
}

export function formatCompactNumber(value: number, currency = "VND") {
  return (value || 0).toLocaleString(metricLocale(currency), { maximumFractionDigits: 0 });
}

export function formatSharePct(value: number, currency = "VND") {
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percent.toLocaleString(metricLocale(currency), { maximumFractionDigits: 0 })}%`;
}

export function formatRatePct(value: number, currency = "VND") {
  return `${(value || 0).toLocaleString(metricLocale(currency), { maximumFractionDigits: 2 })}%`;
}

export function formatMetric(value: number, format: KpiCard["format"], currency = "VND") {
  const locale = metricLocale(currency);
  if (format === "currency") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  }
  if (format === "percent") return formatRatePct(value, currency);
  if (format === "ratio") return `${(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 })}x`;
  return formatCompactNumber(value, currency);
}

export function buildPrompt(args: {
  account: MetaAccount;
  campaigns: MetaCampaign[];
  selectedPack: KpiPack;
  totals: NormalizedRow;
  campaignRows: NormalizedRow[];
  adsetRows: NormalizedRow[];
  adRows: NormalizedRow[];
  dailyRows: NormalizedRow[];
  platformRows: NormalizedRow[];
  ageGenderRows: NormalizedRow[];
  regionRows: NormalizedRow[];
  health: DashboardReport["health"];
  dateRange: { since: string; until: string };
}) {
  const payload = {
    account: args.account.name,
    date_range: args.dateRange,
    selected_pack: args.selectedPack,
    campaigns: args.campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.effective_status || campaign.status,
    })),
    totals: args.totals,
    campaign_rows: args.campaignRows.slice(0, 20),
    adset_rows: args.adsetRows.slice(0, 30),
    ad_rows: args.adRows.slice(0, 30),
    daily_rows: args.dailyRows.slice(-31),
    platform_rows: args.platformRows,
    age_gender_rows: args.ageGenderRows,
    region_rows: args.regionRows,
    health: args.health,
  };
  return `You are a senior Meta Ads strategist. Analyze this campaign data with a long-term system mindset.

Rules:
- Return strict JSON only.
- Do not invent conversions or revenue.
- Separate data-backed findings from assumptions.
- For budget moves, respect Meta learning stability: avoid >20% budget changes at once.
- Flag tracking gaps when Pixel/CAPI/CRM/MER data is absent.
- For 2026 Meta, consider creative diversity, frequency fatigue, campaign consolidation, and objective/KPI fit.

Output schema:
{
  "verdict": "one concise paragraph",
  "risks": ["..."],
  "winners": ["..."],
  "losers": ["..."],
  "budget_moves": ["..."],
  "tests": ["..."],
  "confidence": "low|medium|high",
  "assumptions": ["..."]
}

Input JSON:
${JSON.stringify(payload, null, 2)}`;
}

export function buildInsightPrompt(args: {
  report: DashboardReport;
  previousReport?: DashboardReport | null;
  compareMode: CompareMode;
}) {
  const comparison = args.previousReport
    ? {
        mode: args.compareMode,
        current_range: args.report.dateRange,
        previous_range: args.previousReport.dateRange,
        deltas: comparisonDeltas(args.report, args.previousReport),
      }
    : null;
  const payload = {
    account: args.report.account.name,
    selected_pack: args.report.selectedPack,
    date_range: args.report.dateRange,
    campaigns: args.report.selectedCampaigns.map((campaign) => ({
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.effective_status || campaign.status,
    })),
    totals: args.report.totals,
    top_campaigns: args.report.campaignRows.slice(0, 8),
    top_adsets: args.report.adsetRows.slice(0, 10),
    health: args.report.health,
    comparison,
  };
  return `You are a senior Meta Ads analyst. Return an insight table for a Red Agency ads dashboard.

Rules:
- Return strict JSON only.
- Use current data only. Do not invent revenue, CRM, CAPI, or MER data.
- If comparison exists, focus on what changed, why it matters, and next action.
- If no comparison exists, focus on current health, waste, winners, and tests.
- Use concise table-ready language.

Output schema:
{
  "summary": "one short dashboard summary",
  "rows": [
    {
      "area": "Budget|Creative|Audience|Tracking|Campaign structure|Efficiency",
      "insight": "short finding",
      "evidence": "metric-backed evidence",
      "action": "specific next action",
      "priority": "low|medium|high",
      "confidence": "low|medium|high"
    }
  ],
  "confidence": "low|medium|high",
  "assumptions": ["..."]
}

Input JSON:
${JSON.stringify(payload, null, 2)}`;
}

export function buildCompetitorSpyPrompt(args: {
  competitors: string[];
  market: string;
  platform: CompetitorPlatform;
  notes: string;
  extractedAds?: CompetitorSpyAd[];
  report?: DashboardReport | null;
}) {
  const payload = {
    competitors: args.competitors,
    market_or_offer: args.market || "Not specified",
    platform_focus: args.platform,
    pasted_ad_library_notes: args.notes || "No pasted competitor ad notes provided.",
    extracted_ads: (args.extractedAds || []).slice(0, 40).map((ad) => ({
      source: ad.source,
      competitor: ad.competitorName,
      page: ad.pageName,
      platform: ad.platform,
      body: ad.body,
      headline: ad.headline,
      description: ad.description,
      cta: ad.cta,
      format: ad.format,
      start_date: ad.startDate,
      snapshot_url: ad.snapshotUrl,
      landing_url: ad.landingUrl,
    })),
    current_account_context: args.report
      ? {
          account: args.report.account.name,
          selected_pack: args.report.selectedPack,
          date_range: args.report.dateRange,
          campaigns: args.report.selectedCampaigns.map((campaign) => ({
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.effective_status || campaign.status,
          })),
          totals: args.report.totals,
          top_adsets: args.report.adsetRows.slice(0, 8),
          health: args.report.health,
        }
      : null,
  };
  return `You are a senior paid-social competitive intelligence strategist for Red Agency.

Use the competitor ads framework:
- Identify likely positioning, repeated messaging themes, offers, CTA patterns, creative formats, and platform gaps.
- If extracted_ads are present, treat them as primary evidence and cite ad-level patterns.
- If pasted ad-library notes are present, treat them as evidence.
- If only competitor names are provided, clearly mark findings as hypotheses and do not claim live scraping.
- Use competitor insights for original test ideas only. Do not copy competitor ads, copy, claims, or visual designs.
- Convert findings into practical Meta Ads experiments that fit the current account context when provided.

Return strict JSON only.

Output schema:
{
  "summary": "short competitive readout",
  "competitors": [
    {
      "name": "competitor name",
      "likely_positioning": "short positioning",
      "observed_or_expected_patterns": ["pattern"],
      "gap": "opportunity gap"
    }
  ],
  "themes": [
    {
      "theme": "theme name",
      "evidence": "what was observed or inferred",
      "opportunity": "how Red Agency should respond",
      "confidence": "low|medium|high"
    }
  ],
  "creative_gaps": ["missing format, offer, angle, audience, or proof type"],
  "test_briefs": [
    {
      "angle": "original angle",
      "hook": "new hook, not copied from competitors",
      "format": "static|UGC|carousel|reels|lead form|DM script|other",
      "why": "why this test should matter",
      "guardrail": "metric or ethical guardrail"
    }
  ],
  "next_actions": ["action"],
  "assumptions": ["assumption"]
}

Input JSON:
${JSON.stringify(payload, null, 2)}`;
}

export function comparisonDeltas(current: DashboardReport, previous: DashboardReport) {
  return compareTotals(current.totals, previous.totals);
}
