import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies } = vi.hoisted(() => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })),
}));

vi.mock("next/headers", () => ({ cookies }));

import { GET, POST } from "./route";

describe("Decision Workspace readiness API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns all external acceptance gates without exposing secrets", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.readiness).toMatchObject({
      complete: false,
      totalGates: 20,
    });
    expect(body.readiness.gates).toHaveLength(20);
    expect(JSON.stringify(body)).not.toContain("SESSION_SECRET");
  });

  it("rejects evidence recording without the operator token", async () => {
    const response = await POST(
      new Request("http://localhost/api/readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requirementId: "T3.1.5",
          measuredAt: "2026-07-29T00:00:00.000Z",
          acceptanceMet: true,
          summary: "Provider clustering completed.",
          runId: "provider-run-1",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.recording).toEqual({
      recorded: false,
      reason: "not_requested",
    });
  });
});
