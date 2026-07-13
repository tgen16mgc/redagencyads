import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasTokenSession, hasNineRouterCredentials } = vi.hoisted(() => ({
  hasTokenSession: vi.fn(),
  hasNineRouterCredentials: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ hasTokenSession }));
vi.mock("@/lib/ai/transport", () => ({ hasNineRouterCredentials }));

import { GET } from "./route";

describe("GET /api/capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APIFY_TOKEN;
  });

  it("returns capability states without exposing credentials", async () => {
    hasTokenSession.mockResolvedValue(false);
    hasNineRouterCredentials.mockReturnValue(false);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.capabilities).toEqual(expect.arrayContaining([
      { key: "meta_analysis", state: "needs_connection" },
      { key: "competitor_evidence", state: "available" },
      { key: "tiktok_profiles", state: "needs_setup" },
      { key: "ai_enhancement", state: "degraded" },
    ]));
    expect(JSON.stringify(json)).not.toContain("token");
  });

  it("marks configured server capabilities available", async () => {
    process.env.APIFY_TOKEN = "configured-for-test";
    hasTokenSession.mockResolvedValue(true);
    hasNineRouterCredentials.mockReturnValue(true);

    const response = await GET();
    const json = await response.json();

    expect(json.capabilities).toEqual(expect.arrayContaining([
      { key: "meta_analysis", state: "available" },
      { key: "tiktok_profiles", state: "available" },
      { key: "page_publishing", state: "available" },
      { key: "ai_enhancement", state: "available" },
    ]));
  });
});
