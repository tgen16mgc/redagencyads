import { describe, expect, it } from "vitest";
import { shouldFetchBeforeCompetitorAnalysis } from "../competitor-workflow";

describe("shouldFetchBeforeCompetitorAnalysis", () => {
  it("auto-fetches evidence when user analyzes with competitors but no fetched ads", () => {
    expect(shouldFetchBeforeCompetitorAnalysis({ competitors: ["Seoul Spa"], libraryUrls: [], fetchedAdCount: 0 })).toBe(true);
    expect(shouldFetchBeforeCompetitorAnalysis({ competitors: [], libraryUrls: ["https://www.facebook.com/ads/library/?q=Seoul"], fetchedAdCount: 0 })).toBe(true);
    expect(shouldFetchBeforeCompetitorAnalysis({ competitors: ["Seoul Spa"], libraryUrls: [], fetchedAdCount: 2 })).toBe(false);
    expect(shouldFetchBeforeCompetitorAnalysis({ competitors: [], libraryUrls: [], fetchedAdCount: 0 })).toBe(false);
  });
});
