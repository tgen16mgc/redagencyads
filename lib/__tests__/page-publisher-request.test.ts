import { describe, expect, it, vi } from "vitest";
import { PUBLISH_UPLOAD_TOO_LARGE_MESSAGE, readPublisherJson, uploadFacebookVideo } from "../page-publisher-request";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("readPublisherJson", () => {
  it("turns a plain-text 413 response into a useful publishing error", async () => {
    const response = new Response("Request Entity Too Large", {
      status: 413,
      headers: { "content-type": "text/plain" },
    });

    await expect(readPublisherJson(response, "Unable to submit post.")).rejects.toThrow(PUBLISH_UPLOAD_TOO_LARGE_MESSAGE);
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
});
