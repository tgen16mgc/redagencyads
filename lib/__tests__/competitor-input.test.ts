import { describe, expect, it } from "vitest";
import {
  normalizeCompetitorCountry,
  normalizeCompetitorLimit,
  normalizeCompetitorNames,
  normalizeCompetitorUrls,
} from "../competitor-input";

describe("competitor input normalization", () => {
  it("dedupes competitor names from comma and newline input while preserving order", () => {
    expect(normalizeCompetitorNames("Seoul Spa, Kangnam\nseoul spa\nNha khoa Paris\n")).toEqual([
      "Seoul Spa",
      "Kangnam",
      "Nha khoa Paris",
    ]);
  });

  it("keeps at most eight competitor names", () => {
    expect(normalizeCompetitorNames("A,B,C,D,E,F,G,H,I,J")).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
  });

  it("dedupes valid Meta Ad Library URLs and drops invalid URL text", () => {
    expect(
      normalizeCompetitorUrls(
        "https://www.facebook.com/ads/library/?id=1\nnot a url, https://www.facebook.com/ads/library/?id=1\nhttps://www.facebook.com/ads/library/?id=2",
      ),
    ).toEqual(["https://www.facebook.com/ads/library/?id=1", "https://www.facebook.com/ads/library/?id=2"]);
  });

  it("clamps max ads to a stable crawler range", () => {
    expect(normalizeCompetitorLimit(0)).toBe(1);
    expect(normalizeCompetitorLimit(999)).toBe(80);
    expect(normalizeCompetitorLimit(Number.NaN)).toBe(20);
    expect(normalizeCompetitorLimit(20.8)).toBe(20);
  });

  it("normalizes country to a two-letter uppercase code", () => {
    expect(normalizeCompetitorCountry("vn")).toBe("VN");
    expect(normalizeCompetitorCountry(" usa ")).toBe("US");
    expect(normalizeCompetitorCountry("1")).toBe("VN");
  });
});
