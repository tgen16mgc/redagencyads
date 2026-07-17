import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../../components/dashboard-shell.tsx"), "utf8");

function propHandlerSnippet(prop: "onMarketChange" | "onPlatformChange" | "onLibraryUrlsChange") {
  const start = source.indexOf(`${prop}={(value) => {`);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, start + 180);
}

describe("competitor brief input invalidation", () => {
  it("clears stale analysis when the market or platform changes", () => {
    expect(propHandlerSnippet("onMarketChange")).toContain("invalidateCompetitorBrief");
    expect(propHandlerSnippet("onPlatformChange")).toContain("invalidateCompetitorBrief");
    expect(propHandlerSnippet("onLibraryUrlsChange")).toContain("invalidateCompetitorBrief");
  });
});
