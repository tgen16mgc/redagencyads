import { describe, expect, it } from "vitest";
import { creativeSearchBenchmark } from "@/lib/creative-search";

describe("creative catalog search", () => {
  it("filters 10k records inside the two-second acceptance gate", () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => ({ id: String(index), advertiserName: index % 2 ? "Brand A" : "Brand B", caption: index % 10 === 0 ? "Summer sale hook" : "Evergreen", format: index % 2 ? "video" as const : "image" as const, performanceTier: index % 3 === 0 ? "top" as const : "standard" as const }));
    const benchmark = creativeSearchBenchmark(rows, { keyword: "summer", format: "image" });
    expect(benchmark.recordCount).toBe(10_000);
    expect(benchmark.acceptanceMet).toBe(true);
    expect(benchmark.results.length).toBeGreaterThan(0);
  });
});
