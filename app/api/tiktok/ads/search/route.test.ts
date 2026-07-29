import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readTikTokAcceptanceEvidence } from "@/lib/tiktok-acceptance";
import { POST } from "./route";

let directory = "";

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  delete process.env.TIKTOK_ACCEPTANCE_PATH;
  delete process.env.TIKTOK_ACCEPTANCE_TOKEN;
  delete process.env.TIKTOK_ACCEPTANCE_ENVIRONMENT;
  directory = "";
});

describe("POST /api/tiktok/ads/search", () => {
  it("filters a 10k-record catalog and reports its benchmark duration", async () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => ({ id: String(index), advertiserName: index === 9999 ? "Target Brand" : "Other", caption: index === 9999 ? "launch offer" : "other", format: "video" as const, performanceTier: index === 9999 ? "top" as const : "standard" as const }));
    const response = await POST(new Request("http://localhost/api/tiktok/ads/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows, filters: { keyword: "target brand", performanceTier: "top" } }) }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.recordCount).toBe(10_000);
    expect(typeof body.durationMs).toBe("number");
    expect(body.acceptanceMet).toBe(true);
    expect(body.evidenceRecording).toEqual({
      recorded: false,
      reason: "not_requested",
    });
  });

  it("records a production benchmark only with the operator token", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "tiktok-search-route-"));
    process.env.TIKTOK_ACCEPTANCE_PATH = path.join(
      directory,
      "acceptance.json",
    );
    process.env.TIKTOK_ACCEPTANCE_TOKEN = "acceptance-secret";
    process.env.TIKTOK_ACCEPTANCE_ENVIRONMENT = "production";
    const rows = Array.from({ length: 10_000 }, (_, index) => ({
      id: String(index),
      advertiserName: "Production catalog",
      caption: index === 9999 ? "target" : "other",
      format: "video" as const,
    }));
    const response = await POST(
      new Request("https://decision.example/api/tiktok/ads/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer acceptance-secret",
          "x-acceptance-cohort": "production-catalog-2026-07-29",
        },
        body: JSON.stringify({ rows, filters: { keyword: "target" } }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.evidenceRecording).toMatchObject({
      recorded: true,
      reason: "recorded",
      certification: {
        environment: "production",
        cohortLabel: "production-catalog-2026-07-29",
      },
    });
    expect((await readTikTokAcceptanceEvidence()).search).toMatchObject({
      recordCount: 10_000,
      certification: {
        environment: "production",
        cohortLabel: "production-catalog-2026-07-29",
      },
    });
  });
});
