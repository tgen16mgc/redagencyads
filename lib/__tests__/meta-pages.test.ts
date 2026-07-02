import { afterEach, describe, expect, it, vi } from "vitest";
import { FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE } from "../types";
import { getPages, publishPageFeedPost } from "../meta-pages";

function graphResponse(body: unknown, ok = true, status = 200) {
  return new Response(JSON.stringify(body), { status, statusText: ok ? "OK" : "Bad Request" });
}

function permissionsResponse(permissions: string[]) {
  return graphResponse({
    data: permissions.map((permission) => ({ permission, status: "granted" })),
  });
}

const pagePermissions = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"];
const allPermissions = [...pagePermissions, "instagram_basic", "instagram_content_publish"];

describe("getPages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns only content-capable Pages with publishing capabilities and without exposing access tokens", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(allPermissions))
      .mockResolvedValueOnce(
        graphResponse({
          data: [
            {
              id: "page_1",
              name: "Ready Page",
              category: "Health/beauty",
              tasks: ["CREATE_CONTENT", "MODERATE"],
              access_token: "page-token-1",
              instagram_business_account: { id: "ig_1", username: "ready_ig" },
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
        instagramBusinessAccount: { id: "ig_1", username: "ready_ig" },
        capabilities: {
          facebook: { canPublish: true, canSchedule: true, missingPermissions: [], issues: [] },
          instagram: { canPublish: true, canSchedule: false, missingPermissions: [], issues: [], accountId: "ig_1", username: "ready_ig" },
        },
      },
    ]);
    expect(JSON.stringify(pages)).not.toContain("page-token");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/v22.0/me/permissions");
    expect(String(fetchSpy.mock.calls[1][0])).toContain("/v22.0/me/accounts");
    expect(String(fetchSpy.mock.calls[1][0])).toContain("access_token=user-token");
  });

  it("follows Meta pagination when discovering content-capable Pages", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(pagePermissions))
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
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(String(fetchSpy.mock.calls[2][0])).toContain("after=cursor");
  });
});

describe("publishPageFeedPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("publishes a Page feed post with the selected Page token", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(pagePermissions))
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
      target: "facebook",
      status: "submitted",
      results: [{ target: "facebook", metaPostId: "page_1_123", status: "submitted" }],
    });
    expect(String(fetchSpy.mock.calls[2][0])).toContain("/v22.0/page_1/feed");
    const body = fetchSpy.mock.calls[2][1]?.body as URLSearchParams;
    expect(body.get("access_token")).toBe("page-token-1");
    expect(body.get("message")).toBe("Launch post");
    expect(body.get("link")).toBe("https://example.com/offer");
    expect(body.has("scheduled_publish_time")).toBe(false);
  });

  it("schedules a Page feed post with Meta scheduled_publish_time", async () => {
    const scheduledFor = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(pagePermissions))
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

    const body = fetchSpy.mock.calls[2][1]?.body as URLSearchParams;
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

  it("explains missing Page publishing permissions before calling the publish endpoint", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(["pages_read_engagement"]))
      .mockResolvedValueOnce(
        graphResponse({
          data: [{ id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" }],
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      publishPageFeedPost({ token: "user-token", pageId: "page_1", message: "Hello", mode: "publish_now" }),
    ).rejects.toThrow(FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("normalizes Meta #200 publish errors with Page permission guidance", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(pagePermissions))
      .mockResolvedValueOnce(
        graphResponse({
          data: [{ id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" }],
        }),
      )
      .mockResolvedValueOnce(
        graphResponse(
          {
            error: {
              code: 200,
              message:
                "(#200) If posting to a page, requires both pages_read_engagement and pages_manage_posts as an admin with sufficient administrative permission",
            },
          },
          false,
          400,
        ),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      publishPageFeedPost({ token: "user-token", pageId: "page_1", message: "Hello", mode: "publish_now" }),
    ).rejects.toThrow(FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE);
  });

  it("publishes image and GIF media through the Page photos endpoint", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(pagePermissions))
      .mockResolvedValueOnce(
        graphResponse({
          data: [{ id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" }],
        }),
      )
      .mockResolvedValueOnce(graphResponse({ id: "photo_1", post_id: "page_1_photo_123" }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Photo post",
      mode: "publish_now",
      target: "facebook",
      media: { type: "image", url: "https://cdn.example.com/photo.jpg" },
    });

    expect(String(fetchSpy.mock.calls[2][0])).toContain("/v22.0/page_1/photos");
    const body = fetchSpy.mock.calls[2][1]?.body as URLSearchParams;
    expect(body.get("url")).toBe("https://cdn.example.com/photo.jpg");
    expect(body.get("caption")).toBe("Photo post");
    expect(result.metaPostId).toBe("page_1_photo_123");
    expect(result.media).toEqual({ type: "image", url: "https://cdn.example.com/photo.jpg", name: undefined });
  });

  it("uploads local Facebook media files with multipart Graph bodies", async () => {
    const file = new File(["photo-bytes"], "photo.jpg", { type: "image/jpeg" });
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(pagePermissions))
      .mockResolvedValueOnce(
        graphResponse({
          data: [{ id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" }],
        }),
      )
      .mockResolvedValueOnce(graphResponse({ id: "photo_1", post_id: "page_1_photo_456" }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Local photo",
      mode: "publish_now",
      target: "facebook",
      media: { type: "image", name: "photo.jpg", file },
    });

    expect(String(fetchSpy.mock.calls[2][0])).toContain("/v22.0/page_1/photos");
    const body = fetchSpy.mock.calls[2][1]?.body as FormData;
    expect(body.get("access_token")).toBe("page-token-1");
    expect(body.get("caption")).toBe("Local photo");
    expect(body.get("source")).toBe(file);
    expect(result.media).toEqual({ type: "image", url: undefined, name: "photo.jpg" });
  });

  it("publishes ordered multi-photo Facebook posts through unpublished photo attachments", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(pagePermissions))
      .mockResolvedValueOnce(
        graphResponse({
          data: [{ id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" }],
        }),
      )
      .mockResolvedValueOnce(graphResponse({ id: "photo_first" }))
      .mockResolvedValueOnce(graphResponse({ id: "photo_second" }))
      .mockResolvedValueOnce(graphResponse({ id: "feed_1" }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Carousel copy",
      mode: "publish_now",
      target: "facebook",
      mediaItems: [
        { type: "image", url: "https://cdn.example.com/first.jpg" },
        { type: "gif", url: "https://cdn.example.com/second.gif" },
      ],
    });

    expect(String(fetchSpy.mock.calls[2][0])).toContain("/v22.0/page_1/photos");
    expect(String(fetchSpy.mock.calls[3][0])).toContain("/v22.0/page_1/photos");
    expect(String(fetchSpy.mock.calls[4][0])).toContain("/v22.0/page_1/feed");
    const firstPhotoBody = fetchSpy.mock.calls[2][1]?.body as URLSearchParams;
    const secondPhotoBody = fetchSpy.mock.calls[3][1]?.body as URLSearchParams;
    const feedBody = fetchSpy.mock.calls[4][1]?.body as URLSearchParams;
    expect(firstPhotoBody.get("published")).toBe("false");
    expect(firstPhotoBody.get("url")).toBe("https://cdn.example.com/first.jpg");
    expect(secondPhotoBody.get("url")).toBe("https://cdn.example.com/second.gif");
    expect(feedBody.get("message")).toBe("Carousel copy");
    expect(feedBody.get("attached_media[0]")).toBe(JSON.stringify({ media_fbid: "photo_first" }));
    expect(feedBody.get("attached_media[1]")).toBe(JSON.stringify({ media_fbid: "photo_second" }));
    expect(result.metaPostId).toBe("feed_1");
    expect(result.mediaItems).toEqual([
      { type: "image", url: "https://cdn.example.com/first.jpg", name: undefined },
      { type: "gif", url: "https://cdn.example.com/second.gif", name: undefined },
    ]);
  });

  it("adds temporary photo uploads for scheduled multi-photo Facebook posts", async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(pagePermissions))
      .mockResolvedValueOnce(
        graphResponse({
          data: [{ id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" }],
        }),
      )
      .mockResolvedValueOnce(graphResponse({ id: "photo_first" }))
      .mockResolvedValueOnce(graphResponse({ id: "photo_second" }))
      .mockResolvedValueOnce(graphResponse({ id: "feed_1" }));
    vi.stubGlobal("fetch", fetchSpy);

    await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Scheduled carousel",
      mode: "scheduled",
      scheduledFor,
      target: "facebook",
      mediaItems: [
        { type: "image", url: "https://cdn.example.com/first.jpg" },
        { type: "image", url: "https://cdn.example.com/second.jpg" },
      ],
    });

    const firstPhotoBody = fetchSpy.mock.calls[2][1]?.body as URLSearchParams;
    const secondPhotoBody = fetchSpy.mock.calls[3][1]?.body as URLSearchParams;
    const feedBody = fetchSpy.mock.calls[4][1]?.body as URLSearchParams;
    expect(firstPhotoBody.get("temporary")).toBe("true");
    expect(secondPhotoBody.get("temporary")).toBe("true");
    expect(feedBody.get("published")).toBe("false");
    expect(feedBody.get("scheduled_publish_time")).toBe(String(Math.floor(new Date(scheduledFor).getTime() / 1000)));
  });

  it("rejects multiple media with videos before calling Meta", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      publishPageFeedPost({
        token: "user-token",
        pageId: "page_1",
        message: "Mixed media",
        mode: "publish_now",
        target: "facebook",
        mediaItems: [
          { type: "image", url: "https://cdn.example.com/photo.jpg" },
          { type: "video", url: "https://cdn.example.com/video.mp4" },
        ],
      }),
    ).rejects.toThrow("Multiple media Facebook posts can only use images or GIFs.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects scheduled both-target posts before any partial publish", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      publishPageFeedPost({
        token: "user-token",
        pageId: "page_1",
        message: "Scheduled both",
        mode: "scheduled",
        scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        target: "both",
        media: { type: "image", url: "https://cdn.example.com/photo.jpg" },
      }),
    ).rejects.toThrow("Instagram scheduling is not available here yet; use Facebook or publish now.");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("publishes Instagram media through container and publish endpoints", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(permissionsResponse(allPermissions))
      .mockResolvedValueOnce(
        graphResponse({
          data: [
            {
              id: "page_1",
              name: "Ready Page",
              tasks: ["CREATE_CONTENT"],
              access_token: "page-token-1",
              instagram_business_account: { id: "ig_1", username: "ready_ig" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(graphResponse({ id: "container_1" }))
      .mockResolvedValueOnce(graphResponse({ id: "ig_media_1" }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "IG post",
      mode: "publish_now",
      target: "instagram",
      media: { type: "image", url: "https://cdn.example.com/ig.jpg" },
    });

    expect(String(fetchSpy.mock.calls[2][0])).toContain("/v22.0/ig_1/media");
    const createBody = fetchSpy.mock.calls[2][1]?.body as URLSearchParams;
    expect(createBody.get("access_token")).toBe("user-token");
    expect(createBody.get("image_url")).toBe("https://cdn.example.com/ig.jpg");
    expect(createBody.get("caption")).toBe("IG post");
    expect(String(fetchSpy.mock.calls[3][0])).toContain("/v22.0/ig_1/media_publish");
    const publishBody = fetchSpy.mock.calls[3][1]?.body as URLSearchParams;
    expect(publishBody.get("creation_id")).toBe("container_1");
    expect(result.metaPostId).toBe("ig_media_1");
    expect(result.results).toEqual([{ target: "instagram", metaPostId: "ig_media_1", status: "submitted" }]);
  });
});
