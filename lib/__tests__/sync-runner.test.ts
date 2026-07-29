import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryPipelineStore } from "@/lib/data-pipeline";
const { resolveServerConnectorAccessToken } = vi.hoisted(() => ({
  resolveServerConnectorAccessToken: vi.fn(),
}));
vi.mock("@/lib/server-connector-auth", () => ({
  resolveServerConnectorAccessToken,
}));

import { runConfiguredConnectorSync, runConnectorBackfill } from "@/lib/sync-runner";

describe("connector sync runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveServerConnectorAccessToken.mockResolvedValue(undefined);
  });

  it("executes and persists every requested monthly backfill window", async () => {
    const store = new MemoryPipelineStore();
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const day = url.searchParams.get("startDate") || "2026-07-01";
      return new Response(JSON.stringify({ columnHeaders: [{ name: "day" }, { name: "video" }, { name: "views" }], rows: [[day, `video-${day}`, 100]] }), { status: 200 });
    });
    const result = await runConnectorBackfill({
      platform: "youtube",
      accessToken: "token",
      months: 2,
      now: new Date("2026-07-29T00:00:00.000Z"),
      fetchFn: fetchFn as typeof fetch,
      store,
    });
    expect(result.status).toBe("succeeded");
    expect(result.succeeded).toBe(2);
    expect(result.windows).toEqual([
      { since: "2026-06-01", until: "2026-06-30" },
      { since: "2026-07-01", until: "2026-07-29" },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const snapshot = await store.read();
    expect(snapshot.jobs).toHaveLength(2);
    expect(snapshot.performanceRows).toHaveLength(2);
  });

  it("uses refreshed server access for configured scheduled sources", async () => {
    resolveServerConnectorAccessToken.mockImplementation(
      async ({ platform }: { platform: string }) =>
        platform === "youtube" ? "refreshed-token" : undefined,
    );
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            columnHeaders: [{ name: "day" }, { name: "video" }, { name: "views" }],
            rows: [["2026-07-29", "video-1", 100]],
          }),
          { status: 200 },
        ),
    );

    const result = await runConfiguredConnectorSync({
      mode: "incremental",
      window: { since: "2026-07-29", until: "2026-07-29" },
      env: { YOUTUBE_CHANNEL_ID: "channel-1" },
      fetchFn: fetchFn as typeof fetch,
    });

    expect(result.configuredSources).toEqual(["youtube"]);
    expect(result.jobs[0].status).toBe("succeeded");
    expect(resolveServerConnectorAccessToken).toHaveBeenCalledTimes(3);
  });

  it("records refresh failures as failed scheduled jobs", async () => {
    resolveServerConnectorAccessToken.mockImplementation(
      async ({ platform }: { platform: string }) => {
        if (platform === "google_ads") throw new Error("refresh rejected");
        return undefined;
      },
    );

    const result = await runConfiguredConnectorSync({
      mode: "full",
      window: { since: "2026-07-01", until: "2026-07-29" },
    });

    expect(result.configuredSources).toEqual(["google_ads"]);
    expect(result.jobs[0]).toMatchObject({
      platform: "google_ads",
      status: "failed",
      error: "refresh rejected",
    });
  });
});
