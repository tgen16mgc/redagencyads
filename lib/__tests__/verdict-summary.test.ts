import { describe, expect, it } from "vitest";
import { conciseVerdict, normalizeVerdictText } from "../verdict-summary";

describe("conciseVerdict", () => {
  it("keeps the first complete sentence instead of clipping mid-thought", () => {
    const verdict = "Hold the next scale move until CPA recovers. Spend is concentrated in two ad sets that both sit above target, and frequency is climbing.";
    expect(conciseVerdict(verdict)).toBe("Hold the next scale move until CPA recovers");
  });

  it("drops the trailing period so it reads as a headline", () => {
    expect(conciseVerdict("Protect conversation quality before increasing delivery.")).toBe(
      "Protect conversation quality before increasing delivery",
    );
  });

  it("clips with an ellipsis when even the first sentence is too long", () => {
    const long = `${"a".repeat(200)}. Second sentence.`;
    const result = conciseVerdict(long);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(96);
  });

  it("never breaks a word when clipping", () => {
    const long = `${"alpha bravo ".repeat(40)}charlie. Next.`;
    expect(conciseVerdict(long)).not.toMatch(/\balph\u2026|\bbrav\u2026/);
  });

  it("handles question and exclamation boundaries", () => {
    expect(conciseVerdict("Why is CPA rising? Frequency crossed three.")).toBe("Why is CPA rising?");
  });

  it("collapses whitespace and tolerates empty input", () => {
    expect(normalizeVerdictText("  a\n\n b  ")).toBe("a b");
    expect(conciseVerdict("   ")).toBe("");
    expect(conciseVerdict("")).toBe("");
  });
});
