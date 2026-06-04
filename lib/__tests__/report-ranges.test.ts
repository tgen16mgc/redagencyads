import { describe, expect, it } from "vitest";
import { getCompareRange } from "../report-ranges";

describe("getCompareRange", () => {
  it("returns the same range when comparison is off", () => {
    const range = { since: "2026-06-01", until: "2026-06-04" };

    expect(getCompareRange(range, "off")).toBe(range);
  });

  it("subtracts exactly seven days for WoW comparison", () => {
    expect(getCompareRange({ since: "2026-06-01", until: "2026-06-04" }, "wow")).toEqual({
      since: "2026-05-25",
      until: "2026-05-28",
    });
  });

  it("clamps month-end dates for MoM comparison", () => {
    expect(getCompareRange({ since: "2026-03-31", until: "2026-03-31" }, "mom")).toEqual({
      since: "2026-02-28",
      until: "2026-02-28",
    });
  });

  it("clamps leap day for YoY comparison", () => {
    expect(getCompareRange({ since: "2024-02-29", until: "2024-02-29" }, "yoy")).toEqual({
      since: "2023-02-28",
      until: "2023-02-28",
    });
  });
});
