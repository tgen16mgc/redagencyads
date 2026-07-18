import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireToken,
  startFacebookVideoUpload,
  transferFacebookVideoUpload,
  finishFacebookVideoUpload,
  sealMetaVideoUploadTicket,
  openMetaVideoUploadTicket,
} = vi.hoisted(() => ({
  requireToken: vi.fn(),
  startFacebookVideoUpload: vi.fn(),
  transferFacebookVideoUpload: vi.fn(),
  finishFacebookVideoUpload: vi.fn(),
  sealMetaVideoUploadTicket: vi.fn(),
  openMetaVideoUploadTicket: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireToken }));
vi.mock("@/lib/meta-pages", () => ({
  startFacebookVideoUpload,
  transferFacebookVideoUpload,
  finishFacebookVideoUpload,
}));
vi.mock("@/lib/meta-video-upload-ticket", () => ({ sealMetaVideoUploadTicket, openMetaVideoUploadTicket }));

import { POST } from "./route";

const uploadContext = {
  pageId: "page_1",
  pageName: "Ready Page",
  pageAccessToken: "page-token",
  uploadSessionId: "upload_1",
  videoId: "video_1",
};

describe("POST /api/meta/page-video-uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireToken.mockResolvedValue("user-token");
    openMetaVideoUploadTicket.mockReturnValue(uploadContext);
  });

  it("starts a resumable Meta upload and returns only an opaque ticket", async () => {
    startFacebookVideoUpload.mockResolvedValue({ ...uploadContext, startOffset: 0, endOffset: 4_194_304 });
    sealMetaVideoUploadTicket.mockReturnValue("sealed-ticket");

    const response = await POST(new Request("http://localhost/api/meta/page-video-uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phase: "start", pageId: "page_1", fileName: "launch.mp4", fileSize: 10_000_000 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ upload: { ticket: "sealed-ticket", startOffset: 0, endOffset: 4_194_304 } });
    expect(JSON.stringify(body)).not.toContain("page-token");
  });

  it("forwards one platform-safe video chunk to Meta", async () => {
    const chunk = new File([new Uint8Array(1024)], "launch.mp4", { type: "video/mp4" });
    const formData = new FormData();
    formData.set("phase", "transfer");
    formData.set("ticket", "sealed-ticket");
    formData.set("startOffset", "0");
    formData.set("videoChunk", chunk);
    transferFacebookVideoUpload.mockResolvedValue({ startOffset: 1024, endOffset: 2048 });

    const response = await POST(new Request("http://localhost/api/meta/page-video-uploads", { method: "POST", body: formData }));

    expect(response.status).toBe(200);
    expect(transferFacebookVideoUpload).toHaveBeenCalledWith({
      pageId: "page_1",
      pageAccessToken: "page-token",
      uploadSessionId: "upload_1",
      startOffset: 0,
      chunk: expect.any(File),
    });
  });

  it("rejects chunks larger than the browser upload ceiling", async () => {
    const formData = new FormData();
    formData.set("phase", "transfer");
    formData.set("ticket", "sealed-ticket");
    formData.set("startOffset", "0");
    formData.set("videoChunk", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "oversized.mp4"));

    const response = await POST(new Request("http://localhost/api/meta/page-video-uploads", { method: "POST", body: formData }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("exceeds the platform request limit");
    expect(transferFacebookVideoUpload).not.toHaveBeenCalled();
  });

  it("finishes the upload with its caption and returns the submission", async () => {
    finishFacebookVideoUpload.mockResolvedValue({
      pageId: "page_1",
      pageName: "Ready Page",
      metaPostId: "video_1",
      message: "Launch caption",
      mode: "publish_now",
      target: "facebook",
      status: "submitted",
      createdAt: "2026-07-18T00:00:00.000Z",
    });

    const response = await POST(new Request("http://localhost/api/meta/page-video-uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phase: "finish",
        ticket: "sealed-ticket",
        message: "Launch caption",
        mode: "publish_now",
        fileName: "launch.mp4",
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.submission.metaPostId).toBe("video_1");
    expect(finishFacebookVideoUpload).toHaveBeenCalledWith(expect.objectContaining({
      ...uploadContext,
      message: "Launch caption",
      mode: "publish_now",
      fileName: "launch.mp4",
    }));
  });
});
