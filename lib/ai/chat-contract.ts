import { z } from "zod";

export const CHAT_LIMITS = {
  userMessageCharacters: 2_000,
  assistantMessageCharacters: 4_000,
  historyMessages: 12,
  historyCharacters: 24_000,
  contextCharacters: 32_000,
  outputTokens: 1_400,
  competitorEvidence: 12,
  performanceCampaigns: 10,
  performanceHealthChecks: 12,
  performanceInsights: 8,
  tiktokProfiles: 8,
  tiktokVideos: 12,
} as const;

const shortText = z.string().max(240);
const mediumText = z.string().max(800);
const longText = z.string().max(4_000);
const finiteNumber = z.number().finite();
const confidenceSchema = z.enum(["low", "medium", "high"]);

const capabilitySchema = z.object({
  key: z.enum([
    "meta_analysis",
    "competitor_evidence",
    "tiktok_profiles",
    "tiktok_ad_library",
    "page_publishing",
    "ai_enhancement",
  ]),
  state: z.enum(["available", "needs_connection", "needs_setup", "degraded", "paused", "unknown"]),
}).strict();

const totalsSchema = z.object({
  spend: finiteNumber.optional(),
  impressions: finiteNumber.optional(),
  reach: finiteNumber.optional(),
  frequency: finiteNumber.optional(),
  clicks: finiteNumber.optional(),
  linkClicks: finiteNumber.optional(),
  ctr: finiteNumber.optional(),
  cpc: finiteNumber.optional(),
  cpm: finiteNumber.optional(),
  messages: finiteNumber.optional(),
  replies: finiteNumber.optional(),
  leads: finiteNumber.optional(),
  purchases: finiteNumber.optional(),
  addToCart: finiteNumber.optional(),
  initiateCheckout: finiteNumber.optional(),
  costPerMessage: finiteNumber.optional(),
  costPerReply: finiteNumber.optional(),
  cpl: finiteNumber.optional(),
  cpaPurchase: finiteNumber.optional(),
  roas: finiteNumber.optional(),
  replyRate: finiteNumber.optional(),
  leadRate: finiteNumber.optional(),
}).strict();

const overviewContextSchema = z.object({
  view: z.literal("overview"),
  workspaceLabel: shortText.optional(),
  authenticated: z.boolean(),
  capabilities: z.array(capabilitySchema).max(6),
}).strict();

const performanceContextSchema = z.object({
  view: z.literal("ads"),
  workspaceLabel: shortText.optional(),
  accountName: shortText.optional(),
  currency: z.string().max(12).optional(),
  dateRange: z.object({ since: z.string().max(20), until: z.string().max(20) }).strict().optional(),
  campaigns: z.array(shortText).max(CHAT_LIMITS.performanceCampaigns),
  selectedPack: z.enum(["lead_gen", "messages", "sales_roas", "traffic", "awareness"]).optional(),
  compareMode: z.enum(["off", "wow", "mom", "yoy"]),
  totals: totalsSchema.optional(),
  comparison: z.object({
    dateRange: z.object({ since: z.string().max(20), until: z.string().max(20) }).strict(),
    totals: totalsSchema,
  }).strict().optional(),
  health: z.object({
    score: finiteNumber,
    grade: z.string().max(20),
    checks: z.array(z.object({
      label: shortText,
      status: z.enum(["pass", "warning", "fail"]),
      detail: mediumText,
    }).strict()).max(CHAT_LIMITS.performanceHealthChecks),
  }).strict().optional(),
  targets: z.object({
    targetCpa: finiteNumber.optional(),
    targetRoas: finiteNumber.optional(),
  }).strict(),
  verdict: z.object({
    summary: mediumText,
    risks: z.array(mediumText).max(6),
    winners: z.array(mediumText).max(6),
    losers: z.array(mediumText).max(6),
    budgetMoves: z.array(mediumText).max(6),
    tests: z.array(mediumText).max(6),
    confidence: confidenceSchema,
  }).strict().optional(),
  insights: z.object({
    summary: mediumText,
    confidence: confidenceSchema,
    rows: z.array(z.object({
      area: shortText,
      insight: mediumText,
      evidence: mediumText,
      action: mediumText,
      priority: z.enum(["low", "medium", "high"]),
    }).strict()).max(CHAT_LIMITS.performanceInsights),
  }).strict().optional(),
}).strict();

const competitorContextSchema = z.object({
  view: z.literal("competitor"),
  competitors: z.array(shortText).max(8),
  market: mediumText.optional(),
  platform: z.enum(["meta", "google", "linkedin", "tiktok", "mixed"]),
  collection: z.object({
    outcome: z.enum(["matched", "zero_match", "empty"]),
    fetchedAt: z.string().max(40),
    warnings: z.array(mediumText).max(6),
    coverage: z.array(z.object({
      competitor: shortText,
      collected: finiteNumber,
      matched: finiteNumber,
      accepted: finiteNumber,
      needsReview: finiteNumber,
      rejected: finiteNumber,
    }).strict()).max(8),
  }).strict().optional(),
  acceptedEvidence: z.array(z.object({
    reference: z.string().regex(/^E\d+$/),
    competitor: shortText,
    advertiser: shortText.optional(),
    platform: shortText.optional(),
    headline: shortText.optional(),
    body: mediumText.optional(),
    description: mediumText.optional(),
    cta: shortText.optional(),
    format: shortText.optional(),
  }).strict()).max(CHAT_LIMITS.competitorEvidence),
  brief: z.object({
    summary: mediumText,
    creativeGaps: z.array(mediumText).max(8),
    nextActions: z.array(mediumText).max(8),
    tests: z.array(z.object({
      angle: shortText,
      hook: mediumText,
      format: shortText,
      why: mediumText,
      guardrail: mediumText,
    }).strict()).max(6),
  }).strict().optional(),
}).strict();

const tiktokContextSchema = z.object({
  view: z.literal("tiktok"),
  requestedProfiles: z.array(shortText).max(10),
  pulledAt: z.string().max(40).optional(),
  warnings: z.array(mediumText).max(6),
  profiles: z.array(z.object({
    username: shortText,
    displayName: shortText.optional(),
    bio: mediumText.optional(),
    verified: z.boolean().optional(),
    followerCount: finiteNumber.optional(),
    followingCount: finiteNumber.optional(),
    likesCount: finiteNumber.optional(),
    videoCount: finiteNumber.optional(),
  }).strict()).max(CHAT_LIMITS.tiktokProfiles),
  videos: z.array(z.object({
    reference: z.string().regex(/^V\d+$/),
    username: shortText.optional(),
    caption: mediumText.optional(),
    createdAt: z.string().max(40).optional(),
    playCount: finiteNumber.optional(),
    likeCount: finiteNumber.optional(),
    shareCount: finiteNumber.optional(),
    commentCount: finiteNumber.optional(),
  }).strict()).max(CHAT_LIMITS.tiktokVideos),
}).strict();

const publisherContextSchema = z.object({
  view: z.literal("publisher"),
  pageName: shortText.optional(),
  target: z.enum(["facebook", "instagram", "both"]),
  message: longText.optional(),
  link: mediumText.optional(),
  mode: z.enum(["publish_now", "scheduled"]),
  scheduledFor: z.string().max(40).optional(),
  media: z.object({
    count: z.number().int().min(0).max(20),
    types: z.array(z.enum(["image", "video", "gif"])).max(3),
    hostedCount: z.number().int().min(0).max(20),
    uploadCount: z.number().int().min(0).max(20),
  }).strict(),
  validationMessage: mediumText.optional(),
  queue: z.object({ count: z.number().int().min(0).max(50) }).strict(),
}).strict();

export const chatContextSchema = z.discriminatedUnion("view", [
  overviewContextSchema,
  performanceContextSchema,
  competitorContextSchema,
  tiktokContextSchema,
  publisherContextSchema,
]);

const userMessageSchema = z.object({
  role: z.literal("user"),
  content: z.string().trim().min(1).max(CHAT_LIMITS.userMessageCharacters),
}).strict();

const assistantMessageSchema = z.object({
  role: z.literal("assistant"),
  content: z.string().trim().min(1).max(CHAT_LIMITS.assistantMessageCharacters),
}).strict();

export const chatRequestSchema = z.object({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  contextFingerprint: z.string().regex(/^[a-f0-9]{8}$/),
  language: z.enum(["en", "vi"]),
  context: chatContextSchema,
  messages: z.array(z.discriminatedUnion("role", [userMessageSchema, assistantMessageSchema]))
    .min(1)
    .max(CHAT_LIMITS.historyMessages),
}).strict().superRefine((value, context) => {
  if (value.messages.at(-1)?.role !== "user") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The final conversation message must be from the user.",
      path: ["messages"],
    });
  }

  const historyCharacters = value.messages.reduce((total, message) => total + message.content.length, 0);
  if (historyCharacters > CHAT_LIMITS.historyCharacters) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Conversation history exceeds ${CHAT_LIMITS.historyCharacters} characters.`,
      path: ["messages"],
    });
  }

  if (JSON.stringify(value.context).length > CHAT_LIMITS.contextCharacters) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Workspace context exceeds ${CHAT_LIMITS.contextCharacters} characters.`,
      path: ["context"],
    });
  }
});

export type ChatContext = z.infer<typeof chatContextSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatRequestMessage = ChatRequest["messages"][number];
