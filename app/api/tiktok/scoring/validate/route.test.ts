import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/tiktok/scoring/validate", () => {
  it("accepts strong correlation only after a complete 30-day window", async () => {
    const response = await POST(
      new Request("http://localhost/api/tiktok/scoring/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          samples: [
            {
              score: 20,
              cpa: 100,
              observedAt: "2026-07-01T00:00:00.000Z",
            },
            {
              score: 40,
              cpa: 80,
              observedAt: "2026-07-10T00:00:00.000Z",
            },
            {
              score: 60,
              cpa: 60,
              observedAt: "2026-07-20T00:00:00.000Z",
            },
            {
              score: 80,
              cpa: 40,
              observedAt: "2026-07-30T00:00:00.000Z",
            },
          ],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.validation).toMatchObject({
      sampleSize: 4,
      dateEvidenceComplete: true,
      observationWindowDays: 30,
      acceptanceMet: true,
    });
    expect(body.validation.absoluteCorrelation).toBeGreaterThan(0.6);
    expect(body.evidenceRecording).toEqual({
      recorded: false,
      reason: "not_requested",
    });
  });

  it("rejects samples without valid observation dates", async () => {
    const response = await POST(
      new Request("http://localhost/api/tiktok/scoring/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          samples: [
            { score: 20, cpa: 100 },
            { score: 40, cpa: 80 },
            { score: 60, cpa: 60 },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
