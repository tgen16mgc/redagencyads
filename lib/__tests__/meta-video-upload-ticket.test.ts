import { afterEach, describe, expect, it } from "vitest";
import { openMetaVideoUploadTicket, sealMetaVideoUploadTicket } from "../meta-video-upload-ticket";

const originalSecret = process.env.SESSION_SECRET;

describe("Meta video upload tickets", () => {
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  it("keeps the Page token opaque and binds the upload to the active Meta session", () => {
    process.env.SESSION_SECRET = "test-session-secret";
    const upload = {
      pageId: "page_1",
      pageName: "Ready Page",
      pageAccessToken: "page-token-secret",
      uploadSessionId: "upload_1",
      videoId: "video_1",
    };

    const ticket = sealMetaVideoUploadTicket(upload, "user-token");

    expect(ticket).not.toContain("page-token-secret");
    expect(openMetaVideoUploadTicket(ticket, "user-token")).toEqual(upload);
    expect(openMetaVideoUploadTicket(ticket, "different-user-token")).toBeNull();
  });
});
