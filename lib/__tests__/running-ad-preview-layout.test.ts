import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../../components/dashboard-shell.tsx"), "utf8");

function previewInjectionSnippet() {
  const injection = "dangerouslySetInnerHTML={{ __html: sanitizeAdPreviewHtml(selectedAd.previewHtml) }}";
  const index = source.indexOf(injection);
  expect(index).toBeGreaterThan(-1);
  return source.slice(Math.max(0, index - 700), index + injection.length + 200);
}

describe("RunningAdSetsPanel ad preview layout", () => {
  it("keeps Meta preview embeds scrollable instead of clipping variable-height posts", () => {
    const snippet = previewInjectionSnippet();

    expect(snippet).toContain("overflow-y-auto");
    expect(snippet).not.toContain("[&_iframe]:!h-full");
    expect(snippet).not.toContain("overflow-hidden");
  });
});
