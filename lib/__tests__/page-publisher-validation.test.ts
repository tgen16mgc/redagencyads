import { describe, expect, it } from "vitest";
import { getSchedulePresetDateTimeLocal, validatePagePostDraft } from "../page-publisher-validation";

describe("validatePagePostDraft", () => {
  it("requires a selected page and either message, link, or media", () => {
    expect(validatePagePostDraft({ pageId: "", message: "Hello", link: "", mode: "publish_now", scheduledFor: "", target: "facebook" })).toBe(
      "Choose a Page before publishing.",
    );
    expect(validatePagePostDraft({ pageId: "page_1", message: " ", link: "", mode: "publish_now", scheduledFor: "", target: "facebook" })).toBe(
      "Add a message, link, or media before publishing.",
    );
    expect(
      validatePagePostDraft({
        pageId: "page_1",
        message: " ",
        link: "",
        mode: "publish_now",
        scheduledFor: "",
        target: "facebook",
        media: { type: "image", url: "https://cdn.example.com/photo.jpg" },
      }),
    ).toBeNull();
    expect(validatePagePostDraft({ pageId: "page_1", message: "Hello", link: "", mode: "publish_now", scheduledFor: "", target: "facebook" })).toBeNull();
  });

  it("requires scheduled posts to be at least 10 minutes in the future", () => {
    const now = new Date("2026-07-02T12:00").getTime();

    expect(validatePagePostDraft({ pageId: "page_1", message: "Hello", link: "", mode: "scheduled", scheduledFor: "", target: "facebook" }, now)).toBe(
      "Choose a schedule time.",
    );
    expect(
      validatePagePostDraft({ pageId: "page_1", message: "Hello", link: "", mode: "scheduled", scheduledFor: "2026-07-02T12:05", target: "facebook" }, now),
    ).toBe("Schedule time must be at least 10 minutes in the future.");
    expect(
      validatePagePostDraft({ pageId: "page_1", message: "Hello", link: "", mode: "scheduled", scheduledFor: "2026-07-02T12:15", target: "facebook" }, now),
    ).toBeNull();
  });

  it("requires media for Instagram targets", () => {
    expect(
      validatePagePostDraft({ pageId: "page_1", message: "Text only", link: "", mode: "publish_now", scheduledFor: "", target: "instagram" }),
    ).toBe("Instagram posts require an image, video, or GIF attachment.");
    expect(
      validatePagePostDraft({ pageId: "page_1", message: "Text only", link: "", mode: "publish_now", scheduledFor: "", target: "both" }),
    ).toBe("Instagram posts require an image, video, or GIF attachment.");
  });

  it("requires hosted media for Instagram targets before any partial publish", () => {
    const file = new File(["video"], "launch.mp4", { type: "video/mp4" });

    expect(
      validatePagePostDraft({
        pageId: "page_1",
        message: "Launch",
        link: "",
        mode: "publish_now",
        scheduledFor: "",
        target: "both",
        media: { type: "video", name: file.name, file },
      }),
    ).toBe("Instagram publishing requires a public hosted media URL. Local file uploads are supported only for Facebook.");
  });

  it("allows ordered multi-image media for Facebook only", () => {
    const mediaItems = [
      { type: "image" as const, url: "https://cdn.example.com/first.jpg" },
      { type: "gif" as const, url: "https://cdn.example.com/second.gif" },
    ];

    expect(validatePagePostDraft({ pageId: "page_1", message: "Photos", link: "", mode: "publish_now", scheduledFor: "", target: "facebook", mediaItems })).toBeNull();
    expect(validatePagePostDraft({ pageId: "page_1", message: "Photos", link: "", mode: "publish_now", scheduledFor: "", target: "instagram", mediaItems })).toBe(
      "Multiple media attachments are only supported for Facebook posts right now.",
    );
    expect(validatePagePostDraft({ pageId: "page_1", message: "Photos", link: "", mode: "publish_now", scheduledFor: "", target: "both", mediaItems })).toBe(
      "Multiple media attachments are only supported for Facebook posts right now.",
    );
  });

  it("rejects Facebook multi-media posts containing video", () => {
    expect(
      validatePagePostDraft({
        pageId: "page_1",
        message: "Mixed",
        link: "",
        mode: "publish_now",
        scheduledFor: "",
        target: "facebook",
        mediaItems: [
          { type: "image", url: "https://cdn.example.com/photo.jpg" },
          { type: "video", url: "https://cdn.example.com/video.mp4" },
        ],
      }),
    ).toBe("Multiple media Facebook posts can only use images or GIFs.");
  });

  it("rejects scheduled Instagram or both-target posts because the app has no durable scheduler", () => {
    const now = new Date("2026-07-02T12:00").getTime();

    expect(
      validatePagePostDraft(
        {
          pageId: "page_1",
          message: "Scheduled IG",
          link: "",
          mode: "scheduled",
          scheduledFor: "2026-07-02T12:30",
          target: "instagram",
          media: { type: "image", url: "https://cdn.example.com/photo.jpg" },
        },
        now,
      ),
    ).toBe("Instagram scheduling is not available here yet; use Facebook or publish now.");
    expect(
      validatePagePostDraft(
        {
          pageId: "page_1",
          message: "Scheduled both",
          link: "",
          mode: "scheduled",
          scheduledFor: "2026-07-02T12:30",
          target: "both",
          media: { type: "image", url: "https://cdn.example.com/photo.jpg" },
        },
        now,
      ),
    ).toBe("Instagram scheduling is not available here yet; use Facebook or publish now.");
  });
});

describe("getSchedulePresetDateTimeLocal", () => {
  it("returns friendly local preset times", () => {
    const now = new Date("2026-07-02T12:00:00");

    expect(getSchedulePresetDateTimeLocal("in_1_hour", now)).toBe("2026-07-02T13:00");
    expect(getSchedulePresetDateTimeLocal("tomorrow_morning", now)).toBe("2026-07-03T09:00");
    expect(getSchedulePresetDateTimeLocal("tomorrow_afternoon", now)).toBe("2026-07-03T14:00");
    expect(getSchedulePresetDateTimeLocal("next_weekday_morning", now)).toBe("2026-07-03T09:00");
    expect(getSchedulePresetDateTimeLocal("next_weekday_afternoon", now)).toBe("2026-07-03T14:00");
  });

  it("skips weekends for next weekday presets", () => {
    const friday = new Date("2026-07-03T16:00:00");

    expect(getSchedulePresetDateTimeLocal("next_weekday_morning", friday)).toBe("2026-07-06T09:00");
    expect(getSchedulePresetDateTimeLocal("next_weekday_afternoon", friday)).toBe("2026-07-06T14:00");
  });
});
