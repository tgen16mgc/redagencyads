export type ConnectorId =
  | "meta"
  | "tiktok_public"
  | "google_ads"
  | "youtube_analytics"
  | "ga4_attribution"
  | "linkedin_ads";
export type ConnectorState =
  | "available"
  | "needs_setup"
  | "needs_connection"
  | "paused";
export type SyncConnectorPlatform = "google_ads" | "youtube" | "linkedin";

export function connectorProviderForPlatform(
  platform: SyncConnectorPlatform,
): "google" | "linkedin" {
  return platform === "linkedin" ? "linkedin" : "google";
}

/** Resolve server-side tokens for cron and trusted internal jobs only. */
export function connectorAccessTokenForPlatform(
  platform: SyncConnectorPlatform,
  env: Record<string, string | undefined> = process.env,
) {
  if (platform === "google_ads") return env.GOOGLE_ADS_ACCESS_TOKEN;
  if (platform === "youtube")
    return env.YOUTUBE_ACCESS_TOKEN || env.GOOGLE_ADS_ACCESS_TOKEN;
  return env.LINKEDIN_ACCESS_TOKEN;
}

export type ConnectorContract = {
  id: ConnectorId;
  label: string;
  state: ConnectorState;
  auth: "session" | "apify" | "oauth" | "none";
  scopes: string[];
  sync: "on_demand" | "daily_incremental_weekly_full" | "daily";
  capabilities: string[];
  reason: string;
};

export function buildConnectorContracts(input: {
  metaAuthenticated: boolean;
  apifyConfigured: boolean;
  tiktokFeedConfigured?: boolean;
  googleAdsConfigured?: boolean;
  youtubeConfigured?: boolean;
  ga4Configured?: boolean;
  linkedinConfigured?: boolean;
  googleAdsConnected?: boolean;
  youtubeConnected?: boolean;
  ga4Connected?: boolean;
  linkedinConnected?: boolean;
}): ConnectorContract[] {
  const googleReady = Boolean(input.googleAdsConfigured);
  const youtubeReady = Boolean(input.youtubeConfigured);
  const ga4Ready = Boolean(input.ga4Configured);
  const linkedinReady = Boolean(input.linkedinConfigured);
  const googleConnected = Boolean(input.googleAdsConnected);
  const youtubeConnected = Boolean(input.youtubeConnected);
  const ga4Connected = Boolean(input.ga4Connected);
  const linkedinConnected = Boolean(input.linkedinConnected);
  return [
    {
      id: "meta",
      label: "Meta Ads",
      state: input.metaAuthenticated ? "available" : "needs_connection",
      auth: "session",
      scopes: ["ads_read", "business_management"],
      sync: "on_demand",
      capabilities: [
        "campaign reporting",
        "creative drill-through",
        "budget actions",
      ],
      reason: input.metaAuthenticated
        ? "Authenticated Meta session is available."
        : "Connect Meta to load owned performance data.",
    },
    {
      id: "tiktok_public",
      label: "TikTok public intelligence",
      state:
        input.apifyConfigured || input.tiktokFeedConfigured
          ? "available"
          : "needs_setup",
      auth: "apify",
      scopes: ["public ad library", "public profile metadata"],
      sync: "on_demand",
      capabilities: [
        "creative discovery",
        "hook signals",
        "competitor context",
      ],
      reason: input.tiktokFeedConfigured
        ? "An approved Commercial Content Library or partner feed is configured."
        : input.apifyConfigured
          ? "Apify is configured; public data is available."
          : "Add an approved TikTok feed or APIFY_TOKEN to enable public TikTok intelligence.",
    },
    {
      id: "google_ads",
      label: "Google Ads",
      state: !googleReady
        ? "needs_setup"
        : googleConnected
          ? "available"
          : "needs_connection",
      auth: "oauth",
      scopes: ["https://www.googleapis.com/auth/adwords"],
      sync: "daily_incremental_weekly_full",
      capabilities: [
        "campaign hierarchy",
        "asset performance",
        "cross-platform deduplication",
      ],
      reason: !googleReady
        ? "Configure Google Ads OAuth, developer token, and customer ID before syncing."
        : googleConnected
          ? "Google Ads has a connected browser OAuth session."
          : "Google Ads is configured; complete browser OAuth for interactive access. Server tokens are reserved for scheduled jobs.",
    },
    {
      id: "youtube_analytics",
      label: "YouTube Analytics",
      state: !youtubeReady
        ? "needs_setup"
        : youtubeConnected
          ? "available"
          : "needs_connection",
      auth: "oauth",
      scopes: ["https://www.googleapis.com/auth/yt-analytics.readonly"],
      sync: "daily_incremental_weekly_full",
      capabilities: ["video views", "watch time", "view-through normalization"],
      reason: !youtubeReady
        ? "Configure YouTube Analytics OAuth before syncing owned channel data."
        : youtubeConnected
          ? "YouTube Analytics has a connected Google OAuth session."
          : "YouTube Analytics is configured; complete Google OAuth for interactive access. Server tokens are reserved for scheduled jobs.",
    },
    {
      id: "ga4_attribution",
      label: "GA4 attribution",
      state: !ga4Ready
        ? "needs_setup"
        : ga4Connected
          ? "available"
          : "needs_connection",
      auth: "oauth",
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
      sync: "on_demand",
      capabilities: [
        "reporting attribution model check",
        "attributed key events",
        "attributed revenue",
      ],
      reason: !ga4Ready
        ? "Configure a GA4 property and Google OAuth before enabling data-driven attribution."
        : ga4Connected
          ? "GA4 attribution can use the connected Google account."
          : "GA4 is configured; complete Google OAuth for interactive attribution. Server tokens are reserved for scheduled jobs.",
    },
    {
      id: "linkedin_ads",
      label: "LinkedIn Ads",
      state: !linkedinReady
        ? "needs_setup"
        : linkedinConnected
          ? "available"
          : "needs_connection",
      auth: "oauth",
      scopes: ["r_ads", "r_ads_reporting", "rw_ads"],
      sync: "daily_incremental_weekly_full",
      capabilities: [
        "lead-gen forms",
        "company engagement",
        "account-based reporting",
      ],
      reason: !linkedinReady
        ? "Configure LinkedIn OAuth and an ad account before syncing."
        : linkedinConnected
          ? "LinkedIn Ads has a connected browser OAuth session."
          : "LinkedIn Ads is configured; complete browser OAuth for interactive access. Server tokens are reserved for scheduled jobs.",
    },
  ];
}

export function connectorEnvReadiness(
  env: Record<string, string | undefined> = process.env,
) {
  return {
    googleAdsConfigured: Boolean(
      env.GOOGLE_CLIENT_ID &&
        env.GOOGLE_CLIENT_SECRET &&
        env.GOOGLE_ADS_DEVELOPER_TOKEN &&
        env.GOOGLE_ADS_CUSTOMER_ID,
    ),
    youtubeConfigured: Boolean(
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
    ),
    ga4Configured: Boolean(
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GA4_PROPERTY_ID,
    ),
    linkedinConfigured: Boolean(
      env.LINKEDIN_CLIENT_ID &&
        env.LINKEDIN_CLIENT_SECRET &&
        env.LINKEDIN_AD_ACCOUNT_ID,
    ),
  };
}

export function connectorOAuthConfig(
  provider: "google" | "linkedin",
  redirectUri: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (provider === "google") {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) return null;
    return {
      provider,
      clientId,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri,
      scopes: [
        "https://www.googleapis.com/auth/adwords",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
        "https://www.googleapis.com/auth/analytics.readonly",
      ],
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
    } as const;
  }
  const clientId = env.LINKEDIN_CLIENT_ID;
  if (!clientId) return null;
  return {
    provider,
    clientId,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    redirectUri,
    scopes: ["r_ads", "r_ads_reporting", "rw_ads"],
    authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
    tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
  } as const;
}

export type BacklogPlatformContract = {
  id:
    | "x_ads"
    | "pinterest"
    | "snapchat"
    | "reddit"
    | "dv360"
    | "the_trade_desk";
  label: string;
  priority: "backlog";
  stages: ["auth", "schema", "sync", "ui"];
  state: "needs_setup";
};

export function buildBacklogPlatformContracts(
  _env: Record<string, string | undefined> = process.env,
): BacklogPlatformContract[] {
  return [
    {
      id: "x_ads",
      label: "X Ads",
      priority: "backlog",
      stages: ["auth", "schema", "sync", "ui"],
      state: "needs_setup",
    },
    {
      id: "pinterest",
      label: "Pinterest",
      priority: "backlog",
      stages: ["auth", "schema", "sync", "ui"],
      state: "needs_setup",
    },
    {
      id: "snapchat",
      label: "Snapchat",
      priority: "backlog",
      stages: ["auth", "schema", "sync", "ui"],
      state: "needs_setup",
    },
    {
      id: "reddit",
      label: "Reddit",
      priority: "backlog",
      stages: ["auth", "schema", "sync", "ui"],
      state: "needs_setup",
    },
    {
      id: "dv360",
      label: "DV360",
      priority: "backlog",
      stages: ["auth", "schema", "sync", "ui"],
      state: "needs_setup",
    },
    {
      id: "the_trade_desk",
      label: "The Trade Desk",
      priority: "backlog",
      stages: ["auth", "schema", "sync", "ui"],
      state: "needs_setup",
    },
  ];
}
