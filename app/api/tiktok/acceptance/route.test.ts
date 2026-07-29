import { beforeEach, describe, expect, it, vi } from "vitest";

const buildTikTokAcceptanceSnapshot = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tiktok-acceptance", () => ({
  buildTikTokAcceptanceSnapshot,
}));

import { GET } from "./route";

describe("GET /api/tiktok/acceptance", () => {
  beforeEach(() => {
    buildTikTokAcceptanceSnapshot.mockResolvedValue({
      checkedAt: "2026-07-29T00:00:00.000Z",
      passedCount: 1,
      totalGates: 5,
      readiness: {
        officialFeedConfigured: false,
        digestDeliveryConfigured: false,
      },
      gates: [],
      evidence: {},
    });
  });

  it("returns the consolidated live-evidence snapshot", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.acceptance).toMatchObject({ passedCount: 1, totalGates: 5 });
  });
});
