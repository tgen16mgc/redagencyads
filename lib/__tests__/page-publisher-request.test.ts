import { describe, expect, it, vi } from "vitest";
import {
  PUBLISH_UPLOAD_TOO_LARGE_MESSAGE,
  buildSubmitBody,
  readPublisherJson,
  reconcileScheduleQueue,
  uploadFacebookVideo,
} from "../page-publisher-request";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("buildSubmitBody", () => {
  it("builds a JSON body with trimmed fields and an ISO schedule time for hosted media", () => {
    const body = buildSubmitBody({
      pageId: "page_1",
      message: "  Hello  ",
      link: " https://example.com/launch ",
      mode: "scheduled",
      scheduledFor: "2026-07-02T12:30",
      target: "facebook",
      mediaItems: [{ type: "image", url: "https://cdn.example.com/photo.jpg" }],
    });

    expect(typeof body).toBe("string");
    expect(JSON.parse(body as string)).toEqual({
      pageId: "page_1",
      message: "Hello",
      link: "https://example.com/launch",
      mode: "scheduled",
      scheduledFor: new Date("2026-07-02T12:30").toISOString(),
      target: "facebook",
      mediaItems: [{ type: "image", url: "https://cdn.example.com/photo.jpg" }],
    });
  });

  it("omits empty optional fields from the JSON body", () => {
    const body = buildSubmitBody({
      pageId: "page_1",
      message: " ",
      link: "",
      mode: "publish_now",
      scheduledFor: "",
      target: "facebook",
      mediaItems: [],
    });

    expect(JSON.parse(body as string)).toEqual({ pageId: "page_1", mode: "publish_now", target: "facebook" });
  });

  it("builds multipart form data with fileIndex metadata in media order for mixed media", () => {
    const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
    const second = new File(["second"], "second.gif", { type: "image/gif" });

    const body = buildSubmitBody({
      pageId: "page_1",
      message: "Hello",
      link: "",
      mode: "publish_now",
      scheduledFor: "",
      target: "facebook",
      mediaItems: [
        { type: "gif", name: "second.gif", file: second },
        { type: "image", url: "https://cdn.example.com/hosted.jpg" },
        { type: "image", name: "first.jpg", file: first },
      ],
    });

    expect(body).toBeInstanceOf(FormData);
    const formData = body as FormData;
    expect(formData.get("pageId")).toBe("page_1");
    expect(formData.get("message")).toBe("Hello");
    expect(formData.get("mode")).toBe("publish_now");
    expect(formData.get("target")).toBe("facebook");
    expect(formData.get("scheduledFor")).toBeNull();
    expect(formData.getAll("mediaFiles").map((file) => (file as File).name)).toEqual(["second.gif", "first.jpg"]);
    expect(JSON.parse(String(formData.get("mediaItems")))).toEqual([
      { type: "gif", name: "second.gif", fileIndex: 0 },
      { type: "image", url: "https://cdn.example.com/hosted.jpg" },
      { type: "image", name: "first.jpg", fileIndex: 1 },
    ]);
  });

  it("converts the schedule time to ISO in multipart bodies", () => {
    const file = new File(["clip"], "clip.mp4", { type: "video/mp4" });

    const body = buildSubmitBody({
      pageId: "page_1",
      message: "",
      link: "",
      mode: "scheduled",
      scheduledFor: "2026-07-02T12:30",
      target: "facebook",
      mediaItems: [{ type: "video", name: "clip.mp4", file }],
    }) as FormData;

    expect(body.get("scheduledFor")).toBe(new Date("2026-07-02T12:30").toISOString());
  });
});

describe("reconcileScheduleQueue", () => {
  it("clears the queue when every submission succeeds", () => {
    expect(reconcileScheduleQueue(["a", "b"], [{ ok: true }, { ok: true }])).toEqual([]);
  });

  it("keeps failed items in their original order", () => {
    expect(reconcileScheduleQueue(["a", "b", "c", "d"], [{ ok: false }, { ok: true }, { ok: false }, { ok: true }])).toEqual(["a", "c"]);
  });

  it("keeps items without a matching result", () => {
    expect(reconcileScheduleQueue(["a", "b"], [{ ok: true }])).toEqual(["b"]);
  });
});

describe("readPublisherJson", () => {
  it("turns a plain-text 413 response into a useful publishing error", async () => {
    const response = new Response("Request Entity Too Large", {
      status: 413,
      headers: { "content-type": "text/plain" },
    });

    await expect(readPublisherJson(response, "Unable to submit post.")).rejects.toThrow(PUBLISH_UPLOAD_TOO_LARGE_MESSAGE);
  });

  it("supports a phase-specific message for rejected video chunks", async () => {
    const response = new Response("Request Entity Too Large", { status: 413 });

    await expect(readPublisherJson(response, "Unable to transfer video.", {
      tooLargeMessage: "The video transfer chunk is too large.",
    })).rejects.toThrow("The video transfer chunk is too large.");
  });
});

describe("uploadFacebookVideo", () => {
  it("stops before sending a chunk when Meta returns invalid offsets", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({
      upload: { ticket: "sealed-ticket", startOffset: "invalid", endOffset: 4 },
    }));

    await expect(uploadFacebookVideo(
      {
        pageId: "page_1",
        message: "Launch caption",
        link: "",
        mode: "publish_now",
        scheduledFor: "",
        file: new File([new Uint8Array(10)], "launch.mp4", { type: "video/mp4" }),
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )).rejects.toThrow("Meta returned invalid video upload progress");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("uploads Meta-requested chunks and sends the caption in the finish phase", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ upload: { ticket: "sealed-ticket", startOffset: 0, endOffset: 4 } }))
      .mockResolvedValueOnce(jsonResponse({ upload: { startOffset: 4, endOffset: 8 } }))
      .mockResolvedValueOnce(jsonResponse({ upload: { startOffset: 8, endOffset: 10 } }))
      .mockResolvedValueOnce(jsonResponse({ upload: { startOffset: 10, endOffset: 10 } }))
      .mockResolvedValueOnce(jsonResponse({
        submission: {
          pageId: "page_1",
          pageName: "Ready Page",
          metaPostId: "video_1",
          mode: "publish_now",
          target: "facebook",
          status: "submitted",
          createdAt: "2026-07-18T00:00:00.000Z",
        },
      }));
    const file = new File([new Uint8Array(10)], "launch.mp4", { type: "video/mp4" });
    const onProgress = vi.fn();

    const submission = await uploadFacebookVideo(
      {
        pageId: "page_1",
        message: "Launch caption",
        link: "https://example.com/launch",
        mode: "publish_now",
        scheduledFor: "",
        file,
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch, onProgress },
    );

    expect(submission.metaPostId).toBe("video_1");
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const transferBodies = fetchImpl.mock.calls.slice(1, 4).map((call) => call[1]?.body as FormData);
    expect(transferBodies.map((body) => (body.get("videoChunk") as File).size)).toEqual([4, 4, 2]);
    expect(transferBodies.map((body) => body.get("startOffset"))).toEqual(["0", "4", "8"]);

    const finishBody = JSON.parse(String(fetchImpl.mock.calls[4][1]?.body));
    expect(finishBody).toMatchObject({
      phase: "finish",
      ticket: "sealed-ticket",
      message: "Launch caption",
      link: "https://example.com/launch",
      mode: "publish_now",
      fileName: "launch.mp4",
    });
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it("keeps a Meta 5 MB transfer window below the deployment request limit", async () => {
    const megabyte = 1024 * 1024;
    const fileSize = 5 * megabyte;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ upload: { ticket: "sealed-ticket", startOffset: 0, endOffset: fileSize } }))
      .mockResolvedValueOnce(jsonResponse({ upload: { startOffset: 2 * megabyte, endOffset: fileSize } }))
      .mockResolvedValueOnce(jsonResponse({ upload: { startOffset: 4 * megabyte, endOffset: fileSize } }))
      .mockResolvedValueOnce(jsonResponse({ upload: { startOffset: fileSize, endOffset: fileSize } }))
      .mockResolvedValueOnce(jsonResponse({
        submission: {
          pageId: "page_1",
          pageName: "Ready Page",
          metaPostId: "video_1",
          mode: "publish_now",
          target: "facebook",
          status: "submitted",
          createdAt: "2026-07-18T00:00:00.000Z",
        },
      }));

    await uploadFacebookVideo(
      {
        pageId: "page_1",
        message: "Launch caption",
        link: "",
        mode: "publish_now",
        scheduledFor: "",
        file: new File([new Uint8Array(fileSize)], "launch.mp4", { type: "video/mp4" }),
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    const chunkSizes = fetchImpl.mock.calls
      .slice(1, 4)
      .map((call) => ((call[1]?.body as FormData).get("videoChunk") as File).size);
    expect(chunkSizes).toEqual([2 * megabyte, 2 * megabyte, megabyte]);
  });
});
