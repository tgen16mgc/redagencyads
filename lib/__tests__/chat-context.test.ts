import { describe, expect, it } from "vitest";
import {
  buildCompetitorChatContext,
  buildPublisherChatContext,
  buildTikTokChatContext,
  chatContextFingerprint,
  sanitizeChatText,
} from "../ai/chat-context";
import { chatContextSchema } from "../ai/chat-contract";

describe("chat context builders", () => {
  it("includes only accepted matched competitor evidence and strips raw payloads", () => {
    const context = buildCompetitorChatContext({
      names: ["Alpha"],
      market: "Vietnam",
      platform: "meta",
      result: null,
      evidence: {
        source: "apify",
        outcome: "matched",
        fetchedAt: "2026-07-17T00:00:00.000Z",
        warnings: [],
        coverage: [{ competitor: "Alpha", collected: 3, matched: 2, mediaReady: 2, accepted: 1, needsReview: 1, rejected: 1 }],
        ads: [
          {
            id: "secret-provider-id",
            source: "apify",
            pageName: "Alpha",
            body: "Accepted creative",
            raw: { token: "secret-token" },
            evidence: {
              status: "accepted",
              match: "exact",
              reason: "exact_advertiser_trusted_source",
              matchedToCompetitor: true,
              hasUsableCreative: true,
              requestedCompetitor: "Alpha",
              advertiser: "Alpha",
              sourceUrl: "https://facebook.com/ads/library/?id=secret-id",
              collectedAt: "now",
            },
          },
          {
            id: "rejected-id",
            source: "apify",
            body: "Rejected creative must not appear",
            evidence: {
              status: "rejected",
              match: "mismatch",
              reason: "advertiser_mismatch",
              matchedToCompetitor: false,
              hasUsableCreative: true,
              requestedCompetitor: "Alpha",
              collectedAt: "now",
            },
          },
        ],
      },
    });

    const serialized = JSON.stringify(context);
    expect(context.acceptedEvidence).toHaveLength(1);
    expect(context.acceptedEvidence[0]?.reference).toBe("E1");
    expect(serialized).toContain("Accepted creative");
    expect(serialized).not.toContain("Rejected creative");
    expect(serialized).not.toContain("secret-provider-id");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("sourceUrl");
    expect(chatContextSchema.parse(context)).toEqual(context);
  });

  it("keeps TikTok context to public profile and video fields", () => {
    const context = buildTikTokChatContext({
      profilesInput: "@alpha",
      result: {
        pulledAt: "2026-07-17T00:00:00.000Z",
        warnings: [],
        profiles: [{ username: "alpha", followerCount: 100, raw: { session: "secret" } }],
        videos: [{ id: "video-secret-id", username: "alpha", text: "Hook", playCount: 500, raw: { cookie: "secret" } }],
      },
    });

    const serialized = JSON.stringify(context);
    expect(context.videos[0]?.reference).toBe("V1");
    expect(serialized).not.toContain("video-secret-id");
    expect(serialized).not.toContain("session");
    expect(serialized).not.toContain("cookie");
    expect(chatContextSchema.parse(context)).toEqual(context);
  });

  it("omits upload filenames and URL parameters from publishing context", () => {
    const context = buildPublisherChatContext({
      selectedPage: { id: "page-secret-id", name: "Client Page" },
      target: "facebook",
      message: "Launch post",
      link: "https://example.com/offer?token=secret#private",
      mode: "publish_now",
      scheduledFor: "",
      mediaItems: [
        { type: "image", name: "confidential-campaign.jpg", file: new File(["secret bytes"], "confidential-campaign.jpg") },
        { type: "video", url: "https://cdn.example.com/video.mp4?signature=secret" },
      ],
      queueCount: 2,
    });

    const serialized = JSON.stringify(context);
    expect(context.link).toBe("https://example.com/offer");
    expect(context.media).toEqual({ count: 2, types: ["image", "video"], hostedCount: 1, uploadCount: 1 });
    expect(serialized).not.toContain("page-secret-id");
    expect(serialized).not.toContain("confidential-campaign.jpg");
    expect(serialized).not.toContain("signature");
    expect(serialized).not.toContain("secret bytes");
    expect(chatContextSchema.parse(context)).toEqual(context);
  });

  it("produces stable fingerprints and changes them with context", () => {
    const first = buildTikTokChatContext({ profilesInput: "alpha", result: null });
    const same = buildTikTokChatContext({ profilesInput: "alpha", result: null });
    const changed = buildTikTokChatContext({ profilesInput: "beta", result: null });

    expect(chatContextFingerprint(first)).toBe(chatContextFingerprint(same));
    expect(chatContextFingerprint(first)).toMatch(/^[a-f0-9]{8}$/);
    expect(chatContextFingerprint(first)).not.toBe(chatContextFingerprint(changed));
  });

  it("redacts common bearer and provider tokens before AI transport", () => {
    expect(sanitizeChatText("Use Bearer super-secret-token and sk-abcdefghijklmnop", 200))
      .toBe("Use [redacted] and [redacted]");
  });
});
