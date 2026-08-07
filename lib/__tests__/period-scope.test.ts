import { describe, expect, it } from "vitest";
import { inclusiveDays, isPeriodPreset, rangeFromDays } from "../period-scope";

describe("rangeFromDays", () => {
  it("keeps the requested window inclusive of both end points", () => {
    expect(rangeFromDays(7, "2026-08-05")).toEqual({ since: "2026-07-30", until: "2026-08-05" });
    expect(rangeFromDays(30, "2026-08-05")).toEqual({ since: "2026-07-07", until: "2026-08-05" });
    expect(rangeFromDays(90, "2026-08-05")).toEqual({ since: "2026-05-08", until: "2026-08-05" });
  });

  it("spans month and year boundaries", () => {
    expect(rangeFromDays(30, "2026-01-15")).toEqual({ since: "2025-12-17", until: "2026-01-15" });
  });

  it("falls back to today when no end date is supplied", () => {
    expect(rangeFromDays(7, "").until).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("inclusiveDays", () => {
  it("counts both boundary days", () => {
    expect(inclusiveDays({ since: "2026-07-30", until: "2026-08-05" })).toBe(7);
    expect(inclusiveDays({ since: "2026-08-05", until: "2026-08-05" })).toBe(1);
  });

  it("round-trips every preset window", () => {
    for (const days of [7, 30, 90]) {
      expect(inclusiveDays(rangeFromDays(days, "2026-08-05"))).toBe(days);
    }
  });
});

describe("isPeriodPreset", () => {
  it("only recognises the offered preset windows", () => {
    expect(isPeriodPreset(7)).toBe(true);
    expect(isPeriodPreset(30)).toBe(true);
    expect(isPeriodPreset(90)).toBe(true);
    expect(isPeriodPreset(14)).toBe(false);
    expect(isPeriodPreset(0)).toBe(false);
  });
});
