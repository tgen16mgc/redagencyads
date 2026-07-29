import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/tiktok/deduplication/validate", () => {
  it("measures labeled duplicate groups instead of checking deduped output", async () => {
    const response = await POST(
      new Request("http://localhost/api/tiktok/deduplication/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          samples: [
            {
              expectedCreativeId: "creative-a",
              row: {
                materialId: "source-a-1",
                videoUrl: "https://cdn.example/a.mp4?token=one",
              },
            },
            {
              expectedCreativeId: "creative-a",
              row: {
                materialId: "source-a-2",
                videoUrl: "https://cdn.example/a.mp4?token=two",
              },
            },
            {
              expectedCreativeId: "creative-b",
              row: {
                materialId: "source-b-1",
                imageUrls: ["https://cdn.example/b.jpg"],
              },
            },
            {
              expectedCreativeId: "creative-b",
              row: {
                materialId: "source-b-2",
                imageUrls: ["https://cdn.example/b.jpg"],
              },
            },
          ],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.validation).toMatchObject({
      sampleSize: 4,
      expectedUniqueCount: 2,
      predictedUniqueCount: 2,
      precision: 1,
      recall: 1,
      deduplicationAccuracy: 1,
      acceptanceMet: true,
    });
    expect(body.evidenceRecording).toEqual({
      recorded: false,
      reason: "not_requested",
    });
  });

  it("fails when unrelated labeled creatives are merged", async () => {
    const response = await POST(
      new Request("http://localhost/api/tiktok/deduplication/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          samples: [
            {
              expectedCreativeId: "creative-a",
              row: { materialId: "incorrectly-shared-id" },
            },
            {
              expectedCreativeId: "creative-b",
              row: { materialId: "incorrectly-shared-id" },
            },
          ],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.validation).toMatchObject({
      expectedUniqueCount: 2,
      predictedUniqueCount: 1,
      falsePositivePairs: 1,
      deduplicationAccuracy: 0,
      acceptanceMet: false,
    });
  });
});
