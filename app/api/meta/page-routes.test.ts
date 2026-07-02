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
      status: "submitted",
      createdAt: "2026-07-02T00:00:00.000Z",
    });
    const { POST } = await import("./page-posts/route");

    const response = await POST(
      new Request("http://localhost/api/meta/page-posts", {
        method: "POST",
        body: JSON.stringify({ pageId: "page_1", message: "Hello", mode: "publish_now" }),
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
    });
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
});
