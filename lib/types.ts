export type KpiPack = "lead_gen" | "messages" | "sales_roas" | "traffic" | "awareness";
export type CompareMode = "off" | "wow" | "mom" | "yoy";
export type InterfaceLanguage = "en" | "vi";
export type AiProvider = "9router" | "prompt";
export type VerdictProvider = AiProvider;

export type MetaAccount = {
  id: string;
  name: string;
  account_id?: string;
  currency?: string;
  timezone_name?: string;
};

export type MetaCampaign = {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export type MetaAdSet = {
  id: string;
  name: string;
  campaign_id?: string;
  campaign_name?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export type AdSetPreview = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status: string;
  dailyBudget: number;
  lifetimeBudget: number;
};

export type AdPreview = {
  id: string;
  name: string;
  adsetId: string;
  previewHtml: string;
};

export type AdSetWithPreviews = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status: string;
  dailyBudget: number;
  lifetimeBudget: number;
  ads: AdPreview[];
};

export type InsightAction = {
  action_type: string;
  value: string;
};

export type InsightRow = {
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  publisher_platform?: string;
  platform_position?: string;
  age?: string;
  gender?: string;
  region?: string;
  date_start?: string;
  date_stop?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  spend?: string;
  actions?: InsightAction[];
  cost_per_action_type?: InsightAction[];
  purchase_roas?: InsightAction[];
  website_purchase_roas?: InsightAction[];
};

export type NormalizedRow = {
  id: string;
  level: "account" | "campaign" | "adset" | "ad" | "breakdown" | "daily";
  name: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  date?: string;
  platform?: string;
  placement?: string;
  age?: string;
  gender?: string;
  region?: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  messages: number;
  replies: number;
  leads: number;
  purchases: number;
  addToCart: number;
  initiateCheckout: number;
  costPerMessage: number;
  costPerReply: number;
  cpl: number;
  cpaPurchase: number;
  roas: number;
  replyRate: number;
  leadRate: number;
  adFormat?: string;
  dailyBudget?: number;
  learningStageStatus?: "LEARNING" | "LEARNING_LIMITED" | "NOT_LEARNING" | "NO_SIGNAL";
  learningStageReasons?: Array<"LOW_VOLUME" | "NOT_ENOUGH_BUDGET" | "CREATIVE_FATIGUE" | "HIGH_OVERLAP" | "LOW_QUALITY">;
};

export type KpiCard = {
  key: keyof NormalizedRow | "healthScore";
  label: string;
  format: "number" | "currency" | "percent" | "ratio";
  intent?: "neutral" | "good" | "warning" | "danger";
};

export type DashboardReport = {
  account: MetaAccount;
  selectedCampaigns: MetaCampaign[];
  dateRange: { since: string; until: string };
  detectedPack: KpiPack;
  selectedPack: KpiPack;
  packReason: string;
  kpis: KpiCard[];
  totals: NormalizedRow;
  campaignRows: NormalizedRow[];
  adsetRows: NormalizedRow[];
  adRows: NormalizedRow[];
  dailyRows: NormalizedRow[];
  platformRows: NormalizedRow[];
  ageGenderRows: NormalizedRow[];
  health: {
    score: number;
    grade: string;
    checks: { id: string; label: string; status: "pass" | "warning" | "fail"; detail: string }[];
  };
  prompt: string;
  pulledAt: string;
  adsetPreviews?: AdSetWithPreviews[];
};

export type Verdict = {
  verdict: string;
  risks: string[];
  winners: string[];
  losers: string[];
  budget_moves: string[];
  tests: string[];
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  provider: VerdictProvider;
};

export type AiVerdict = Verdict;

export type AiInsight = {
  area: string;
  insight: string;
  evidence: string;
  action: string;
  priority: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
};

export type AiInsightTable = {
  summary: string;
  rows: AiInsight[];
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  provider: AiProvider;
};

export type CompetitorPlatform = "meta" | "google" | "linkedin" | "tiktok" | "mixed";
export type CompetitorFetchSource = "public" | "meta_official" | "apify";

export type CompetitorSpyAd = {
  id: string;
  source: CompetitorFetchSource;
  competitorName?: string;
  pageName?: string;
  platform?: string;
  body?: string;
  headline?: string;
  description?: string;
  cta?: string;
  format?: string;
  startDate?: string;
  endDate?: string;
  snapshotUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  landingUrl?: string;
  raw?: unknown;
};

export type CompetitorFetchResult = {
  source: CompetitorFetchSource;
  ads: CompetitorSpyAd[];
  warnings: string[];
  fetchedAt: string;
};

export type CompetitorSpyResult = {
  summary: string;
  competitors: {
    name: string;
    likely_positioning: string;
    observed_or_expected_patterns: string[];
    gap: string;
  }[];
  themes: {
    theme: string;
    evidence: string;
    opportunity: string;
    confidence: "low" | "medium" | "high";
  }[];
  creative_gaps: string[];
  test_briefs: {
    angle: string;
    hook: string;
    format: string;
    why: string;
    guardrail: string;
  }[];
  next_actions: string[];
  assumptions: string[];
  provider: AiProvider;
};
