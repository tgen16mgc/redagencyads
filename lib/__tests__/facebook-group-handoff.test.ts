import { describe, expect, it } from "vitest";
import {
  buildFacebookGroupHandoffText,
  getFacebookSubmissionUrl,
  normalizeFacebookGroupUrl,
  sanitizeFacebookGroupDestinations,
} from "../facebook-group-handoff";

describe("normalizeFacebookGroupUrl", () => {
  it("canonicalizes Facebook Group destinations and removes post/query paths", () => {
    expect(normalizeFacebookGroupUrl("m.facebook.com/groups/client-community/posts/123?ref=share")).toBe(
      "https://www.facebook.com/groups/client-community/",
    );
    expect(normalizeFacebookGroupUrl("https://facebook.com/groups/123456789/"))
      .toBe("https://www.facebook.com/groups/123456789/");
  });

  it("rejects non-Group and lookalike URLs", () => {
    expect(normalizeFacebookGroupUrl("https://www.facebook.com/client-page")).toBeNull();
    expect(normalizeFacebookGroupUrl("https://facebook.example.com/groups/123")).toBeNull();
    expect(normalizeFacebookGroupUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("sanitizeFacebookGroupDestinations", () => {
  it("drops invalid rows, deduplicates URLs, and supplies a readable fallback name", () => {
    expect(sanitizeFacebookGroupDestinations([
      { name: "", url: "facebook.com/groups/client-community" },
      { name: "Client Community", url: "https://m.facebook.com/groups/client-community/?ref=bookmarks" },
      { name: "Invalid", url: "https://example.com/groups/other" },
    ])).toEqual([
      { name: "Client Community", url: "https://www.facebook.com/groups/client-community/" },
    ]);
  });
});

describe("Facebook Group handoff content", () => {
  it("uses the live Facebook Page post when a submission is available", () => {
    const submission = {
      pageId: "123",
      pageName: "Client Page",
      metaPostId: "123_456",
      message: "Launch day",
      link: "https://example.com/offer",
      mode: "publish_now" as const,
      target: "facebook" as const,
      status: "submitted" as const,
      createdAt: "2026-07-18T00:00:00.000Z",
    };

    const facebookPostUrl = getFacebookSubmissionUrl(submission);
    expect(facebookPostUrl).toBe("https://www.facebook.com/123/posts/456");
    expect(buildFacebookGroupHandoffText({
      message: submission.message,
      link: submission.link,
      facebookPostUrl,
    })).toBe("Launch day\n\nhttps://www.facebook.com/123/posts/456");
  });

  it("uses the draft link and avoids copying duplicate URLs", () => {
    expect(buildFacebookGroupHandoffText({ message: "Read more", link: "https://example.com/offer" }))
      .toBe("Read more\n\nhttps://example.com/offer");
    expect(buildFacebookGroupHandoffText({ message: "Read https://example.com/offer", link: "https://example.com/offer" }))
      .toBe("Read https://example.com/offer");
  });

  it("does not create a Facebook URL for an Instagram-only submission", () => {
    expect(getFacebookSubmissionUrl({
      pageId: "123",
      pageName: "Client Page",
      metaPostId: "ig_456",
      mode: "publish_now",
      target: "instagram",
      status: "submitted",
      createdAt: "2026-07-18T00:00:00.000Z",
      results: [{ target: "instagram", metaPostId: "ig_456", status: "submitted" }],
    })).toBeUndefined();
  });
});
