import { afterEach, describe, expect, it, vi } from "vitest";
import { runApifyActor } from "../apify";

describe("runApifyActor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("runs an actor synchronously and returns dataset items", async () => {
    vi.stubEnv("APIFY_TOKEN", "apify-token");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ id: "row-1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const items = await runApifyActor<{ id: string }>({
      actorId: "clockworks/tiktok-profile-scraper",
      input: { profiles: ["redagency"] },
      timeoutSeconds: 120,
    });

    expect(items).toEqual([{ id: "row-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?clean=true&format=json&timeout=120",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer apify-token",
        },
        body: JSON.stringify({ profiles: ["redagency"] }),
      }),
    );
  });

  it("requires APIFY_TOKEN", async () => {
    vi.stubEnv("APIFY_TOKEN", "");

    await expect(runApifyActor({ actorId: "actor/id", input: {} })).rejects.toThrow("APIFY_TOKEN is required");
  });
});
