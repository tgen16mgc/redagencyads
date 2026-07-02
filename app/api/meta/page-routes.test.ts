import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireToken, getPages, publishPageFeedPost } = vi.hoisted(() => ({
  requireToken: vi.fn(),
  getPages: vi.fn(),
  publishPageFeedPost: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireToken,
}));

vi.mock("@/lib/meta-pages", () => ({
  getPages,
  publishPageFeedPost,
}));

describe("Meta Pages API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireToken.mockResolvedValue("user-token");
  });

  it("returns connected content-capable Pages", async () => {
    getPages.mockResolvedValue([{ id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"] }]);
    const { GET } = await import("./pages/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ pages: [{ id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"] }] });
    expect(getPages).toHaveBeenCalledWith("user-token");
  });

  it("publishes a page post through the server-side token", async () => {
    publishPageFeedPost.mockResolvedValue({
      pageId: "page_1",
      pageName: "Ready Page",
      metaPostId: "page_1_123",
      message: "Hello",
      mode: "publish_now",
      target: "facebook",
      status: "submitted",
      createdAt: "2026-07-02T00:00:00.000Z",
    });
    const { POST } = await import("./page-posts/route");

    const response = await POST(
      new Request("http://localhost/api/meta/page-posts", {
        method: "POST",
        body: JSON.stringify({ pageId: "page_1", message: "Hello", mode: "publish_now", target: "facebook" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.submission).toMatchObject({ metaPostId: "page_1_123", status: "submitted" });
    expect(publishPageFeedPost).toHaveBeenCalledWith({
      token: "user-token",
      pageId: "page_1",
      message: "Hello",
      link: undefined,
      mode: "publish_now",
      scheduledFor: undefined,
      target: "facebook",
      media: undefined,
    });
  });

  it("passes media URL payloads to the publisher", async () => {
    publishPageFeedPost.mockResolvedValue({
      pageId: "page_1",
      pageName: "Ready Page",
      metaPostId: "photo_1",
      message: "Hello",
      mode: "publish_now",
      target: "facebook",
      status: "submitted",
      createdAt: "2026-07-02T00:00:00.000Z",
    });
    const { POST } = await import("./page-posts/route");

    const response = await POST(
      new Request("http://localhost/api/meta/page-posts", {
        method: "POST",
        body: JSON.stringify({
          pageId: "page_1",
          message: "Hello",
          mode: "publish_now",
          target: "facebook",
          media: { type: "image", url: "https://cdn.example.com/photo.jpg" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(publishPageFeedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        media: { type: "image", url: "https://cdn.example.com/photo.jpg" },
      }),
    );
  });

  it("passes local media file payloads to the publisher", async () => {
    const file = new File(["photo-bytes"], "photo.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.set("pageId", "page_1");
    formData.set("message", "Hello");
    formData.set("mode", "publish_now");
    formData.set("target", "facebook");
    formData.set("mediaType", "image");
    formData.set("mediaFile", file);
    publishPageFeedPost.mockResolvedValue({
      pageId: "page_1",
      pageName: "Ready Page",
      metaPostId: "photo_1",
      message: "Hello",
      mode: "publish_now",
      target: "facebook",
      status: "submitted",
      createdAt: "2026-07-02T00:00:00.000Z",
    });
    const { POST } = await import("./page-posts/route");

    const response = await POST(new Request("http://localhost/api/meta/page-posts", { method: "POST", body: formData }));

    expect(response.status).toBe(200);
    expect(publishPageFeedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        media: { type: "image", name: "photo.jpg", file },
      }),
    );
  });

  it("publishes bulk schedule items with item-level results", async () => {
    publishPageFeedPost
      .mockResolvedValueOnce({
        pageId: "page_1",
        pageName: "Ready Page",
        metaPostId: "post_1",
        message: "First",
        mode: "scheduled",
        target: "facebook",
        status: "scheduled",
        createdAt: "2026-07-02T00:00:00.000Z",
      })
      .mockRejectedValueOnce(new Error("Reconnect Meta with pages_manage_posts to publish Facebook Page posts."));
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { POST } = await import("./page-posts/route");

    const response = await POST(
      new Request("http://localhost/api/meta/page-posts", {
        method: "POST",
        body: JSON.stringify({
          items: [
            { pageId: "page_1", message: "First", mode: "scheduled", scheduledFor, target: "facebook" },
            { pageId: "page_1", message: "Second", mode: "scheduled", scheduledFor, target: "facebook" },
          ],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body.results).toMatchObject([
      { ok: true, submission: { metaPostId: "post_1" } },
      { ok: false, error: "Reconnect Meta with pages_manage_posts to publish Facebook Page posts." },
    ]);
    expect(publishPageFeedPost).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid page post requests", async () => {
    const { POST } = await import("./page-posts/route");

    const response = await POST(
      new Request("http://localhost/api/meta/page-posts", {
        method: "POST",
        body: JSON.stringify({ pageId: "", mode: "publish_now" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(publishPageFeedPost).not.toHaveBeenCalled();
  });

  it("rejects unsupported page post link schemes", async () => {
    const { POST } = await import("./page-posts/route");

    const response = await POST(
      new Request("http://localhost/api/meta/page-posts", {
        method: "POST",
        body: JSON.stringify({ pageId: "page_1", link: "mailto:team@example.com", mode: "publish_now" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(publishPageFeedPost).not.toHaveBeenCalled();
  });

  it("rejects Instagram posts without media", async () => {
    const { POST } = await import("./page-posts/route");

    const response = await POST(
      new Request("http://localhost/api/meta/page-posts", {
        method: "POST",
        body: JSON.stringify({ pageId: "page_1", message: "Text only", mode: "publish_now", target: "instagram" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(publishPageFeedPost).not.toHaveBeenCalled();
  });
});
