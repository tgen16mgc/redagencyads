export type CapabilityKey =
  | "meta_analysis"
  | "competitor_evidence"
  | "tiktok_profiles"
  | "tiktok_ad_library"
  | "page_publishing"
  | "ai_enhancement";

export type CapabilityState = "available" | "needs_connection" | "needs_setup" | "degraded" | "paused" | "unknown";

export type CapabilityStatus = {
  key: CapabilityKey;
  state: CapabilityState;
};

export const CAPABILITY_KEYS: CapabilityKey[] = [
  "meta_analysis",
  "competitor_evidence",
  "tiktok_profiles",
  "tiktok_ad_library",
  "page_publishing",
  "ai_enhancement",
];

export function buildUnknownCapabilitySnapshot(): CapabilityStatus[] {
  return CAPABILITY_KEYS.map((key) => ({ key, state: "unknown" }));
}

export function buildCapabilitySnapshot(input: {
  authenticated: boolean;
  apifyConfigured: boolean;
  competitorActorConfigured: boolean;
  nineRouterConfigured: boolean;
}): CapabilityStatus[] {
  return [
    {
      key: "meta_analysis",
      state: input.authenticated ? "available" : "needs_connection",
    },
    {
      key: "competitor_evidence",
      state: input.apifyConfigured && input.competitorActorConfigured ? "available" : "needs_setup",
    },
    {
      key: "tiktok_profiles",
      state: input.apifyConfigured ? "available" : "needs_setup",
    },
    {
      key: "tiktok_ad_library",
      state: "paused",
    },
    {
      key: "page_publishing",
      state: input.authenticated ? "available" : "needs_connection",
    },
    {
      key: "ai_enhancement",
      state: input.nineRouterConfigured ? "available" : "degraded",
    },
  ];
}

export function capabilityStatus(
  capabilities: CapabilityStatus[],
  key: CapabilityKey,
): CapabilityStatus | undefined {
  return capabilities.find((capability) => capability.key === key);
}
