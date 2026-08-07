import { describe, expect, it } from "vitest";
import {
  FATIGUE_FREQUENCY_THRESHOLD,
  buildCreativeSignals,
  concentrationStatus,
  fatiguedCreatives,
  spendConcentration,
} from "../creative-signals";
import type { NormalizedRow } from "../types";

function row(id: string, spend: number, frequency: number): NormalizedRow {
  return { id, name: id, spend, frequency } as NormalizedRow;
}

describe("spendConcentration", () => {
  it("measures the top spenders regardless of incoming row order", () => {
    const rows = [row("a", 10, 1), row("b", 70, 1), row("c", 20, 1)];
    expect(spendConcentration(rows)).toBe(90);
    expect(spendConcentration([...rows].reverse())).toBe(90);
  });

  it("returns 0 instead of NaN when nothing has spent", () => {
    expect(spendConcentration([row("a", 0, 1), row("b", 0, 1)])).toBe(0);
    expect(spendConcentration([])).toBe(0);
  });

  it("is 100 percent when every creative fits in the window", () => {
    expect(spendConcentration([row("a", 5, 1), row("b", 5, 1)])).toBe(100);
  });
});

describe("concentrationStatus", () => {
  it("uses the documented thresholds", () => {
    expect(concentrationStatus(70)).toBe("concentrated");
    expect(concentrationStatus(65)).toBe("concentrated");
    expect(concentrationStatus(50)).toBe("watch");
    expect(concentrationStatus(45)).toBe("watch");
    expect(concentrationStatus(44)).toBe("balanced");
  });
});

describe("fatiguedCreatives", () => {
  it("counts creatives at or above the fatigue threshold", () => {
    const rows = [row("a", 1, 2.9), row("b", 1, 3), row("c", 1, 4.2)];
    expect(fatiguedCreatives(rows).map((item) => item.id)).toEqual(["b", "c"]);
    expect(FATIGUE_FREQUENCY_THRESHOLD).toBe(3);
  });
});

describe("buildCreativeSignals", () => {
  it("summarises the creative panel in one pass", () => {
    const rows = [row("a", 80, 3.4), row("b", 10, 1.2), row("c", 10, 1.1)];
    expect(buildCreativeSignals(rows)).toEqual({
      fatigueCount: 1,
      totalCreatives: 3,
      concentration: 90,
      concentrationStatus: "concentrated",
      topSpendShareCount: 2,
    });
  });
});
