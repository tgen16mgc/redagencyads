import { beforeEach, describe, expect, it, vi } from "vitest";
import { FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE } from "../types";

const { graphList, graphRequest } = vi.hoisted(() => ({
  graphList: vi.fn(),
  graphRequest: vi.fn(),
}));

vi.mock("@/lib/meta-graph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../meta-graph")>()),
  graphList,
  graphRequest,
}));

import { MetaGraphRequestError } from "../meta-graph";
import {
  finishFacebookVideoUpload,
  getPages,
  publishPageFeedPost,
  startFacebookVideoUpload,
  transferFacebookVideoUpload,
} from "../meta-pages";

const pagePermissions = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"];
const allPermissions = [...pagePermissions, "instagram_basic", "instagram_content_publish"];
const readyPage = { id: "page_1", name: "Ready Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" };

function stubGraph(args: { permissions?: string[]; pages?: unknown[]; posts?: Array<unknown | Error> }) {
  const posts = [...(args.posts || [])];
  graphRequest.mockImplementation(async (request: { path: string }) => {
    if (request.path === "/me/permissions") {
      return { data: (args.permissions || []).map((permission) => ({ permission, status: "granted" })) };
    }
    const next = posts.shift();
    if (next === undefined) throw new Error(`Unexpected graphRequest: ${request.path}`);
    if (next instanceof Error) throw next;
    return next;
  });
  graphList.mockResolvedValue(args.pages || []);
}

function postCalls() {
  return graphRequest.mock.calls.map(([args]) => args).filter((args) => args.method === "POST");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPages", () => {
  it("returns only content-capable Pages with publishing capabilities and without exposing access tokens", async () => {
    stubGraph({
      permissions: allPermissions,
      pages: [
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
    });

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
    expect(graphRequest).toHaveBeenCalledWith({ path: "/me/permissions", token: "user-token" });
    expect(graphList).toHaveBeenCalledWith({
      path: "/me/accounts",
      params: { fields: "id,name,category,tasks,access_token,instagram_business_account{id,username}" },
      token: "user-token",
    });
  });

  it("returns every content-capable Page from the paginated Graph listing", async () => {
    stubGraph({
      permissions: pagePermissions,
      pages: [
        { id: "page_1", name: "First Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-1" },
        { id: "page_2", name: "Second Page", tasks: ["CREATE_CONTENT"], access_token: "page-token-2" },
      ],
    });

    const pages = await getPages("user-token");

    expect(pages.map((page) => page.name)).toEqual(["First Page", "Second Page"]);
    expect(graphList).toHaveBeenCalledTimes(1);
  });
});

describe("publishPageFeedPost", () => {
  it("publishes a Page feed post with the selected Page token", async () => {
    stubGraph({ permissions: pagePermissions, pages: [readyPage], posts: [{ id: "page_1_123" }] });

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
    const [post] = postCalls();
    expect(post).toMatchObject({ path: "/page_1/feed", method: "POST" });
    const body = post.body as URLSearchParams;
    expect(body.get("access_token")).toBe("page-token-1");
    expect(body.get("message")).toBe("Launch post");
    expect(body.get("link")).toBe("https://example.com/offer");
    expect(body.has("scheduled_publish_time")).toBe(false);
  });

  it("publishes when Page discovery succeeded without pages_show_list in granted permissions", async () => {
    stubGraph({
      permissions: ["pages_read_engagement", "pages_manage_posts"],
      pages: [readyPage],
      posts: [{ id: "page_1_123" }],
    });

    await expect(
      publishPageFeedPost({
        token: "user-token",
        pageId: "page_1",
        message: "Launch post",
        mode: "publish_now",
      }),
    ).resolves.toMatchObject({ metaPostId: "page_1_123" });
    expect(postCalls()[0]).toMatchObject({ path: "/page_1/feed" });
  });

  it("schedules a Page feed post with Meta scheduled_publish_time", async () => {
    const scheduledFor = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    stubGraph({ permissions: pagePermissions, pages: [readyPage], posts: [{ id: "page_1_456" }] });

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Scheduled post",
      mode: "scheduled",
      scheduledFor,
    });

    const body = postCalls()[0].body as URLSearchParams;
    expect(result.status).toBe("scheduled");
    expect(body.get("published")).toBe("false");
    expect(body.get("scheduled_publish_time")).toBe(String(Math.floor(new Date(scheduledFor).getTime() / 1000)));
  });

  it("rejects scheduled posts less than ten minutes in the future before calling Meta", async () => {
    await expect(
      publishPageFeedPost({
        token: "user-token",
        pageId: "page_1",
        message: "Too soon",
        mode: "scheduled",
        scheduledFor: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }),
    ).rejects.toThrow("Schedule time must be at least 10 minutes in the future.");

    expect(graphRequest).not.toHaveBeenCalled();
    expect(graphList).not.toHaveBeenCalled();
  });

  it("explains missing Page publishing permissions before calling the publish endpoint", async () => {
    stubGraph({ permissions: ["pages_read_engagement"], pages: [readyPage] });

    await expect(
      publishPageFeedPost({ token: "user-token", pageId: "page_1", message: "Hello", mode: "publish_now" }),
    ).rejects.toThrow(FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE);

    expect(postCalls()).toHaveLength(0);
  });

  it("normalizes Meta #200 publish errors with Page permission guidance", async () => {
    stubGraph({
      permissions: pagePermissions,
      pages: [readyPage],
      posts: [
        new MetaGraphRequestError(400, {
          code: 200,
          message:
            "(#200) If posting to a page, requires both pages_read_engagement and pages_manage_posts as an admin with sufficient administrative permission",
        }),
      ],
    });

    await expect(
      publishPageFeedPost({ token: "user-token", pageId: "page_1", message: "Hello", mode: "publish_now" }),
    ).rejects.toThrow(FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE);
  });

  it("publishes image and GIF media through the Page photos endpoint", async () => {
    stubGraph({ permissions: pagePermissions, pages: [readyPage], posts: [{ id: "photo_1", post_id: "page_1_photo_123" }] });

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Photo post",
      mode: "publish_now",
      target: "facebook",
      media: { type: "image", url: "https://cdn.example.com/photo.jpg" },
    });

    const [post] = postCalls();
    expect(post).toMatchObject({ path: "/page_1/photos", method: "POST" });
    const body = post.body as URLSearchParams;
    expect(body.get("url")).toBe("https://cdn.example.com/photo.jpg");
    expect(body.get("caption")).toBe("Photo post");
    expect(result.metaPostId).toBe("page_1_photo_123");
    expect(result.media).toEqual({ type: "image", url: "https://cdn.example.com/photo.jpg", name: undefined });
  });

  it("uploads local Facebook media files with multipart Graph bodies", async () => {
    const file = new File(["photo-bytes"], "photo.jpg", { type: "image/jpeg" });
    stubGraph({ permissions: pagePermissions, pages: [readyPage], posts: [{ id: "photo_1", post_id: "page_1_photo_456" }] });

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "Local photo",
      mode: "publish_now",
      target: "facebook",
      media: { type: "image", name: "photo.jpg", file },
    });

    const [post] = postCalls();
    expect(post).toMatchObject({ path: "/page_1/photos" });
    const body = post.body as FormData;
    expect(body.get("access_token")).toBe("page-token-1");
    expect(body.get("caption")).toBe("Local photo");
    expect(body.get("source")).toBe(file);
    expect(result.media).toEqual({ type: "image", url: undefined, name: "photo.jpg" });
  });

  it("publishes ordered multi-photo Facebook posts through unpublished photo attachments", async () => {
    stubGraph({
      permissions: pagePermissions,
      pages: [readyPage],
      posts: [{ id: "photo_first" }, { id: "photo_second" }, { id: "feed_1" }],
    });

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

    const posts = postCalls();
    expect(posts.map((post) => post.path)).toEqual(["/page_1/photos", "/page_1/photos", "/page_1/feed"]);
    const firstPhotoBody = posts[0].body as URLSearchParams;
    const secondPhotoBody = posts[1].body as URLSearchParams;
    const feedBody = posts[2].body as URLSearchParams;
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
    stubGraph({
      permissions: pagePermissions,
      pages: [readyPage],
      posts: [{ id: "photo_first" }, { id: "photo_second" }, { id: "feed_1" }],
    });

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

    const posts = postCalls();
    const firstPhotoBody = posts[0].body as URLSearchParams;
    const secondPhotoBody = posts[1].body as URLSearchParams;
    const feedBody = posts[2].body as URLSearchParams;
    expect(firstPhotoBody.get("temporary")).toBe("true");
    expect(secondPhotoBody.get("temporary")).toBe("true");
    expect(feedBody.get("published")).toBe("false");
    expect(feedBody.get("scheduled_publish_time")).toBe(String(Math.floor(new Date(scheduledFor).getTime() / 1000)));
  });

  it("rejects multiple media with videos before calling Meta", async () => {
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
    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("rejects scheduled both-target posts before any partial publish", async () => {
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

    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("rejects local Instagram media before any partial Facebook publish", async () => {
    await expect(
      publishPageFeedPost({
        token: "user-token",
        pageId: "page_1",
        message: "Both targets",
        mode: "publish_now",
        target: "both",
        media: { type: "video", name: "launch.mp4", file: new File(["video"], "launch.mp4") },
      }),
    ).rejects.toThrow("Instagram publishing requires a public hosted media URL");

    expect(graphRequest).not.toHaveBeenCalled();
  });

  it("publishes Instagram media through container and publish endpoints", async () => {
    stubGraph({
      permissions: allPermissions,
      pages: [{ ...readyPage, instagram_business_account: { id: "ig_1", username: "ready_ig" } }],
      posts: [{ id: "container_1" }, { id: "ig_media_1" }],
    });

    const result = await publishPageFeedPost({
      token: "user-token",
      pageId: "page_1",
      message: "IG post",
      mode: "publish_now",
      target: "instagram",
      media: { type: "image", url: "https://cdn.example.com/ig.jpg" },
    });

    const posts = postCalls();
    expect(posts[0]).toMatchObject({ path: "/ig_1/media", method: "POST" });
    const createBody = posts[0].body as URLSearchParams;
    expect(createBody.get("access_token")).toBe("user-token");
    expect(createBody.get("image_url")).toBe("https://cdn.example.com/ig.jpg");
    expect(createBody.get("caption")).toBe("IG post");
    expect(posts[1]).toMatchObject({ path: "/ig_1/media_publish", method: "POST" });
    const publishBody = posts[1].body as URLSearchParams;
    expect(publishBody.get("creation_id")).toBe("container_1");
    expect(result.metaPostId).toBe("ig_media_1");
    expect(result.results).toEqual([{ target: "instagram", metaPostId: "ig_media_1", status: "submitted" }]);
  });
});

describe("resumable Facebook video uploads", () => {
  it("starts a graph-video upload with the selected Page token", async () => {
    stubGraph({
      permissions: pagePermissions,
      pages: [readyPage],
      posts: [{ upload_session_id: "upload_1", video_id: "video_1", start_offset: "0", end_offset: "4194304" }],
    });

    const upload = await startFacebookVideoUpload({ token: "user-token", pageId: "page_1", fileSize: 12_000_000 });

    expect(upload).toMatchObject({ uploadSessionId: "upload_1", videoId: "video_1", startOffset: 0, endOffset: 4_194_304 });
    const [post] = postCalls();
    expect(post).toMatchObject({ path: "/page_1/videos", method: "POST", host: "graph-video.facebook.com" });
    const body = post.body as URLSearchParams;
    expect(body.get("file_size")).toBe("12000000");
    expect(body.get("access_token")).toBe("page-token-1");
  });

  it("transfers the exact chunk and advances using Meta offsets", async () => {
    const chunk = new File([new Uint8Array(1024)], "launch.mp4", { type: "video/mp4" });
    stubGraph({ posts: [{ start_offset: "1024", end_offset: "2048" }] });

    const progress = await transferFacebookVideoUpload({
      pageId: "page_1",
      pageAccessToken: "page-token-1",
      uploadSessionId: "upload_1",
      startOffset: 0,
      chunk,
    });

    expect(progress).toEqual({ startOffset: 1024, endOffset: 2048 });
    const [post] = postCalls();
    expect(post).toMatchObject({ path: "/page_1/videos", host: "graph-video.facebook.com" });
    const body = post.body as FormData;
    expect(body.get("upload_phase")).toBe("transfer");
    expect(body.get("video_file_chunk")).toMatchObject({ name: "launch.mp4", size: 1024, type: "video/mp4" });
  });

  it("finishes a scheduled video with the caption and schedule metadata", async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    stubGraph({ posts: [{ success: true }] });

    const submission = await finishFacebookVideoUpload({
      pageId: "page_1",
      pageName: "Ready Page",
      pageAccessToken: "page-token-1",
      uploadSessionId: "upload_1",
      videoId: "video_1",
      message: "Launch caption",
      mode: "scheduled",
      scheduledFor,
      fileName: "launch.mp4",
    });

    const [post] = postCalls();
    expect(post).toMatchObject({ path: "/page_1/videos", host: "graph-video.facebook.com" });
    const body = post.body as URLSearchParams;
    expect(body.get("description")).toBe("Launch caption");
    expect(body.get("published")).toBe("false");
    expect(body.get("scheduled_publish_time")).toBe(String(Math.floor(new Date(scheduledFor).getTime() / 1000)));
    expect(submission).toMatchObject({ metaPostId: "video_1", status: "scheduled", media: { type: "video", name: "launch.mp4" } });
  });
});
