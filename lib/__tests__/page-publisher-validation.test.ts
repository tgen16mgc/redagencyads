import { describe, expect, it } from "vitest";
import { validatePagePostDraft } from "../page-publisher-validation";

describe("validatePagePostDraft", () => {
  it("requires a selected page and either message or link", () => {
    expect(validatePagePostDraft({ pageId: "", message: "Hello", link: "", mode: "publish_now", scheduledFor: "" })).toBe(
      "Choose a Page before publishing.",
    );
    expect(validatePagePostDraft({ pageId: "page_1", message: " ", link: "", mode: "publish_now", scheduledFor: "" })).toBe(
      "Add a message or link before publishing.",
    );
    expect(validatePagePostDraft({ pageId: "page_1", message: "Hello", link: "", mode: "publish_now", scheduledFor: "" })).toBeNull();
  });

  it("requires scheduled posts to be at least 10 minutes in the future", () => {
    const now = new Date("2026-07-02T12:00").getTime();

    expect(validatePagePostDraft({ pageId: "page_1", message: "Hello", link: "", mode: "scheduled", scheduledFor: "" }, now)).toBe(
      "Choose a schedule time.",
    );
    expect(
      validatePagePostDraft({ pageId: "page_1", message: "Hello", link: "", mode: "scheduled", scheduledFor: "2026-07-02T12:05" }, now),
    ).toBe("Schedule time must be at least 10 minutes in the future.");
    expect(
      validatePagePostDraft({ pageId: "page_1", message: "Hello", link: "", mode: "scheduled", scheduledFor: "2026-07-02T12:15" }, now),
    ).toBeNull();
  });
});
