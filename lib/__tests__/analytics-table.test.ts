import { describe, expect, it } from "vitest";
import { analyticsNumber, selectAnalyticsRows } from "../analytics-table";
import { buildSampleReport } from "../sample-report";

describe("analytics table", () => {
  const base = buildSampleReport().campaignRows[0];
  const rows = [
    { ...base, id: "one", name: "Alpha", spend: 150, purchases: 0, metricAvailability: {} },
    { ...base, id: "two", name: "Beta", spend: 50, purchases: 2, metricAvailability: {} },
    { ...base, id: "three", name: "Untracked", spend: 200, purchases: 0, metricAvailability: { purchases: "not_tracked" as const } },
  ];
  it("filters spend without outcomes without accusing untracked rows", () => {
    expect(selectAnalyticsRows(rows, "", "purchases", true, "spend", "desc").map((row) => row.id)).toEqual(["one"]);
  });
  it("searches IDs and sorts without mutating source rows", () => {
    expect(selectAnalyticsRows(rows, " TWO ", "purchases", false, "spend", "desc")[0].name).toBe("Beta");
    expect(selectAnalyticsRows(rows, "", "purchases", false, "spend", "desc").map((row) => row.id)).toEqual(["three", "one", "two"]);
    expect(rows[0].id).toBe("one");
  });
  it("distinguishes invalid metrics from genuine zero and tolerates invalid currency", () => {
    expect(analyticsNumber(NaN)).toBe("—");
    expect(analyticsNumber(Infinity, "USD")).toBe("—");
    expect(analyticsNumber(0)).toBe("0");
    expect(analyticsNumber(1250, "invalid")).toBe("1,250");
  });
});
