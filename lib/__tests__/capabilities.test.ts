import { describe, expect, it } from "vitest";
import { buildCapabilitySnapshot, buildUnknownCapabilitySnapshot, capabilityStatus } from "../capabilities";

describe("buildCapabilitySnapshot", () => {
  it("separates account connection, provider setup, degradation, and paused products", () => {
    const capabilities = buildCapabilitySnapshot({
      authenticated: false,
      apifyConfigured: false,
      competitorActorConfigured: false,
      nineRouterConfigured: false,
    });

    expect(capabilityStatus(capabilities, "meta_analysis")?.state).toBe("needs_connection");
    expect(capabilityStatus(capabilities, "competitor_evidence")?.state).toBe("needs_setup");
    expect(capabilityStatus(capabilities, "tiktok_profiles")?.state).toBe("needs_setup");
    expect(capabilityStatus(capabilities, "tiktok_ad_library")?.state).toBe("paused");
    expect(capabilityStatus(capabilities, "page_publishing")?.state).toBe("needs_connection");
    expect(capabilityStatus(capabilities, "ai_enhancement")?.state).toBe("degraded");
  });

  it("marks connected and configured capabilities available", () => {
    const capabilities = buildCapabilitySnapshot({
      authenticated: true,
      apifyConfigured: true,
      competitorActorConfigured: true,
      nineRouterConfigured: true,
    });

    expect(capabilityStatus(capabilities, "meta_analysis")?.state).toBe("available");
    expect(capabilityStatus(capabilities, "competitor_evidence")?.state).toBe("available");
    expect(capabilityStatus(capabilities, "tiktok_profiles")?.state).toBe("available");
    expect(capabilityStatus(capabilities, "page_publishing")?.state).toBe("available");
    expect(capabilityStatus(capabilities, "ai_enhancement")?.state).toBe("available");
  });

  it("represents a failed capability check without claiming setup is missing", () => {
    const capabilities = buildUnknownCapabilitySnapshot();

    expect(capabilities).toHaveLength(6);
    expect(capabilities.every((capability) => capability.state === "unknown")).toBe(true);
  });
});
