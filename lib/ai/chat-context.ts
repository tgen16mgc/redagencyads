import type { CapabilityStatus } from "@/lib/capabilities";
import type {
  AiInsightTable,
  CompareMode,
  CompetitorFetchResult,
  CompetitorPlatform,
  CompetitorSpyResult,
  DashboardReport,
  MediaAttachment,
  MetaPage,
  PagePostMode,
  PublishTarget,
  TikTokProfileResult,
  Verdict,
} from "@/lib/types";
import { CHAT_LIMITS, type ChatContext } from "@/lib/ai/chat-contract";

const SECRET_PATTERNS = [
  /\bBearer\s+[^\s]+/gi,
  /\bsk-[a-zA-Z0-9_-]{12,}\b/g,
  /\bEA[A-Za-z0-9]{20,}\b/g,
];

function cleanText(value: unknown, maxCharacters: number) {
  if (typeof value !== "string") return undefined;
  let cleaned = value.trim();
  for (const pattern of SECRET_PATTERNS) cleaned = cleaned.replace(pattern, "[redacted]");
  return cleaned ? cleaned.slice(0, maxCharacters) : undefined;
}

export function sanitizeChatText(value: string, maxCharacters: number) {
  return cleanText(value, maxCharacters) || "";
}

function cleanList(values: string[] | undefined, maxItems: number, maxCharacters: number) {
  return (values || [])
    .map((value) => cleanText(value, maxCharacters))
    .filter((value): value is string => Boolean(value))
    .slice(0, maxItems);
}

function cleanUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return `${url.origin}${url.pathname}`.slice(0, 800);
  } catch {
    return undefined;
  }
}

function compactTotals(report: DashboardReport | null | undefined) {
  if (!report) return undefined;
  const totals = report.totals;
  return {
    spend: totals.spend,
    impressions: totals.impressions,
    reach: totals.reach,
    frequency: totals.frequency,
    clicks: totals.clicks,
    linkClicks: totals.linkClicks,
    ctr: totals.ctr,
    cpc: totals.cpc,
    cpm: totals.cpm,
    messages: totals.messages,
    replies: totals.replies,
    leads: totals.leads,
    purchases: totals.purchases,
    addToCart: totals.addToCart,
    initiateCheckout: totals.initiateCheckout,
    costPerMessage: totals.costPerMessage,
    costPerReply: totals.costPerReply,
    cpl: totals.cpl,
    cpaPurchase: totals.cpaPurchase,
    roas: totals.roas,
    replyRate: totals.replyRate,
    leadRate: totals.leadRate,
  };
}

export function buildOverviewChatContext(input: {
  workspaceLabel?: string;
  authenticated: boolean;
  capabilities: CapabilityStatus[];
}): Extract<ChatContext, { view: "overview" }> {
  return {
    view: "overview",
    workspaceLabel: cleanText(input.workspaceLabel, 240),
    authenticated: input.authenticated,
    capabilities: input.capabilities.slice(0, 6).map(({ key, state }) => ({ key, state })),
  };
}

export function buildPerformanceChatContext(input: {
  workspaceLabel?: string;
  report: DashboardReport | null;
  previousReport: DashboardReport | null;
  compareMode: CompareMode;
  targets: { targetCpa?: number; targetRoas?: number };
  verdict: Verdict | null;
  insights: AiInsightTable | null;
}): Extract<ChatContext, { view: "ads" }> {
  const { report, previousReport, verdict, insights } = input;
  return {
    view: "ads",
    workspaceLabel: cleanText(input.workspaceLabel, 240),
    accountName: cleanText(report?.account.name, 240),
    currency: cleanText(report?.account.currency, 12),
    dateRange: report ? { ...report.dateRange } : undefined,
    campaigns: cleanList(report?.selectedCampaigns.map((campaign) => campaign.name), CHAT_LIMITS.performanceCampaigns, 240),
    selectedPack: report?.selectedPack,
    compareMode: input.compareMode,
    totals: compactTotals(report),
    comparison: previousReport && input.compareMode !== "off" ? {
      dateRange: { ...previousReport.dateRange },
      totals: compactTotals(previousReport)!,
    } : undefined,
    health: report ? {
      score: report.health.score,
      grade: report.health.grade.slice(0, 20),
      checks: report.health.checks.slice(0, CHAT_LIMITS.performanceHealthChecks).map((check) => ({
        label: cleanText(check.label, 240) || "Check",
        status: check.status,
        detail: cleanText(check.detail, 800) || "",
      })),
    } : undefined,
    targets: input.targets,
    verdict: verdict ? {
      summary: cleanText(verdict.verdict, 800) || "",
      risks: cleanList(verdict.risks, 6, 800),
      winners: cleanList(verdict.winners, 6, 800),
      losers: cleanList(verdict.losers, 6, 800),
      budgetMoves: cleanList(verdict.budget_moves, 6, 800),
      tests: cleanList(verdict.tests, 6, 800),
      confidence: verdict.confidence,
    } : undefined,
    insights: insights ? {
      summary: cleanText(insights.summary, 800) || "",
      confidence: insights.confidence,
      rows: insights.rows.slice(0, CHAT_LIMITS.performanceInsights).map((row) => ({
        area: cleanText(row.area, 240) || "Performance",
        insight: cleanText(row.insight, 800) || "",
        evidence: cleanText(row.evidence, 800) || "",
        action: cleanText(row.action, 800) || "",
        priority: row.priority,
      })),
    } : undefined,
  };
}

export function buildCompetitorChatContext(input: {
  names: string[];
  market: string;
  platform: CompetitorPlatform;
  evidence: CompetitorFetchResult | null;
  result: CompetitorSpyResult | null;
}): Extract<ChatContext, { view: "competitor" }> {
  const accepted = (input.evidence?.ads || [])
    .filter((ad) => ad.evidence?.status === "accepted" && ad.evidence.matchedToCompetitor && ad.evidence.hasUsableCreative)
    .slice(0, CHAT_LIMITS.competitorEvidence);

  return {
    view: "competitor",
    competitors: cleanList(input.names, 8, 240),
    market: cleanText(input.market, 800),
    platform: input.platform,
    collection: input.evidence ? {
      outcome: input.evidence.outcome,
      fetchedAt: input.evidence.fetchedAt.slice(0, 40),
      warnings: cleanList(input.evidence.warnings, 6, 800),
      coverage: input.evidence.coverage.slice(0, 8).map((coverage) => ({
        competitor: cleanText(coverage.competitor, 240) || "Competitor",
        collected: coverage.collected,
        matched: coverage.matched,
        accepted: coverage.accepted,
        needsReview: coverage.needsReview,
        rejected: coverage.rejected,
      })),
    } : undefined,
    acceptedEvidence: accepted.map((ad, index) => ({
      reference: `E${index + 1}`,
      competitor: cleanText(ad.evidence?.requestedCompetitor || ad.competitorName, 240) || "Competitor",
      advertiser: cleanText(ad.evidence?.advertiser || ad.pageName, 240),
      platform: cleanText(ad.platform, 240),
      headline: cleanText(ad.headline, 240),
      body: cleanText(ad.body, 800),
      description: cleanText(ad.description, 800),
      cta: cleanText(ad.cta, 240),
      format: cleanText(ad.format, 240),
    })),
    brief: input.result ? {
      summary: cleanText(input.result.summary, 800) || "",
      creativeGaps: cleanList(input.result.creative_gaps, 8, 800),
      nextActions: cleanList(input.result.next_actions, 8, 800),
      tests: input.result.test_briefs.slice(0, 6).map((test) => ({
        angle: cleanText(test.angle, 240) || "",
        hook: cleanText(test.hook, 800) || "",
        format: cleanText(test.format, 240) || "",
        why: cleanText(test.why, 800) || "",
        guardrail: cleanText(test.guardrail, 800) || "",
      })),
    } : undefined,
  };
}

export function buildTikTokChatContext(input: {
  profilesInput: string;
  result: TikTokProfileResult | null;
}): Extract<ChatContext, { view: "tiktok" }> {
  const requestedProfiles = input.profilesInput
    .split(/[\n,]/)
    .map((profile) => profile.trim().replace(/^@/, ""))
    .filter(Boolean)
    .slice(0, 10);
  const videos = [...(input.result?.videos || [])]
    .sort((left, right) => (right.playCount || 0) - (left.playCount || 0))
    .slice(0, CHAT_LIMITS.tiktokVideos);

  return {
    view: "tiktok",
    requestedProfiles: cleanList(requestedProfiles, 10, 240),
    pulledAt: input.result?.pulledAt.slice(0, 40),
    warnings: cleanList(input.result?.warnings, 6, 800),
    profiles: (input.result?.profiles || []).slice(0, CHAT_LIMITS.tiktokProfiles).map((profile) => ({
      username: cleanText(profile.username, 240) || "unknown",
      displayName: cleanText(profile.displayName, 240),
      bio: cleanText(profile.bio, 800),
      verified: profile.verified,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      likesCount: profile.likesCount,
      videoCount: profile.videoCount,
    })),
    videos: videos.map((video, index) => ({
      reference: `V${index + 1}`,
      username: cleanText(video.username, 240),
      caption: cleanText(video.text, 800),
      createdAt: video.createdAt?.slice(0, 40),
      playCount: video.playCount,
      likeCount: video.likeCount,
      shareCount: video.shareCount,
      commentCount: video.commentCount,
    })),
  };
}

export function buildPublisherChatContext(input: {
  selectedPage?: MetaPage;
  target: PublishTarget;
  message: string;
  link: string;
  mode: PagePostMode;
  scheduledFor: string;
  mediaItems: MediaAttachment[];
  validationMessage?: string;
  queueCount: number;
}): Extract<ChatContext, { view: "publisher" }> {
  const types = Array.from(new Set(input.mediaItems.map((media) => media.type)));
  return {
    view: "publisher",
    pageName: cleanText(input.selectedPage?.name, 240),
    target: input.target,
    message: cleanText(input.message, 4_000),
    link: cleanUrl(input.link),
    mode: input.mode,
    scheduledFor: cleanText(input.scheduledFor, 40),
    media: {
      count: Math.min(input.mediaItems.length, 20),
      types,
      hostedCount: Math.min(input.mediaItems.filter((media) => Boolean(media.url)).length, 20),
      uploadCount: Math.min(input.mediaItems.filter((media) => Boolean(media.file)).length, 20),
    },
    validationMessage: cleanText(input.validationMessage, 800),
    queue: { count: Math.min(Math.max(input.queueCount, 0), 50) },
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

export function chatContextFingerprint(context: ChatContext) {
  const input = JSON.stringify(stableValue(context));
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
