import { afterEach, describe, expect, it, vi } from "vitest";
import { getPages, publishPageFeedPost } from "../meta-pages";

function graphResponse(body: unknown, ok = true, status = 200) {
  return new Response(JSON.stringify(body), { status, statusText: ok ? "OK" : "Bad Request" });
}

describe("getPages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns only content-capable Pages without exposing access tokens", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      graphResponse({
        data: [
          {
            id: "page_1",
            name: "Ready Page",
            category: "Health/beauty",
            tasks: ["CREATE_CONTENT", "MODERATE"],
            access_token: "page-token-1",
          },
          {
            id: "page_2",
            name: "Read Only Page",
            category: "Local service",
            tasks: ["ANALYZE"],
            access_token: "page-token-2",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const pages = await getPages("user-token");

    expect(pages).toEqual([
      {
        id: "page_1",
        name: "Ready Page",
        category: "Health/beauty",
        tasks: ["CREATE_CONTENT", "MODERATE"],
      },
    ]);
    expect(JSON.stringify(pages)).not.toContain("page-token");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/v22.0/me/accounts");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("access_token=user-token");
  });

  it("follows Meta pagination when discovering content-capable Pages", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        graphResponse({
          data: [{ id: "page_1", name: "First Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" }],
          paging: { next: "https://graph.facebook.com/v22.0/me/accounts?after=cursor" },
        }),
      )
      .mockResolvedValueOnce(
        graphResponse({
          data: [{ id: "page_2", name: "Second Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-2" }],
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const pages = await getPages("user-token");

    expect(pages.map((page) => page.name)).toEqual(["First Page", "Second Page"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][0])).toContain("after=cursor");
  });
});

describe("publishPageFeedPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("publishes a Page feed post with the selected Page token", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        graphResponse({
          data: [
            {
              id: "page_1",
              name: "Ready Page",
              tasks: ["CREATE_CONTENT"],
              access_token: "page-token-1",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(graphResponse({ id: "page_1_123" }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Launch post",
      link: "https://example.com/offer",
      mode: "publish_now",
    });

    expect(result).toMatchObject({
      pageId: "page_1",
      pageName: "Ready Page",
      metaPostId: "page_1_123",
      message: "Launch post",
      link: "https://example.com/offer",
      mode: "publish_now",
      status: "submitted",
    });
    expect(String(fetchSpy.mock.calls[1][0])).toContain("/v22.0/page_1/feed");
    const body = fetchSpy.mock.calls[1][1]?.body as URLSearchParams;
    expect(body.get("access_token")).toBe("page-token-1");
    expect(body.get("message")).toBe("Launch post");
    expect(body.get("link")).toBe("https://example.com/offer");
    expect(body.has("scheduled_publish_time")).toBe(false);
  });

  it("schedules a Page feed post with Meta scheduled_publish_time", async () => {
    const scheduledFor = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        graphResponse({
          data: [
            {
              id: "page_1",
              name: "Ready Page",
              tasks: ["CREATE_CONTENT"],
              access_token: "page-token-1",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(graphResponse({ id: "page_1_456" }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Scheduled post",
      mode: "scheduled",
      scheduledFor,
    });

    const body = fetchSpy.mock.calls[1][1]?.body as URLSearchParams;
    expect(result.status).toBe("scheduled");
    expect(body.get("published")).toBe("false");
    expect(body.get("scheduled_publish_time")).toBe(String(Math.floor(new Date(scheduledFor).getTime() / 1000)));
  });

  it("rejects scheduled posts less than ten minutes in the future before calling Meta publish", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      publishPageFeedPost({
        token: "user-token",
        pageId: "page_1",
        message: "Too soon",
        mode: "scheduled",
        scheduledFor: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }),
    ).rejects.toThrow("Schedule time must be at least 10 minutes in the future.");

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
