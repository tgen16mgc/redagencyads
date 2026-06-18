import { describe, expect, it } from "vitest";
import {
  buildCustomKpiCards,
  deserializeCustomKpiSet,
  getCustomKpiCatalogGroups,
  serializeCustomKpiSet,
} from "../custom-kpi-set";
import type { KpiCard } from "../types";

const defaultKpis: KpiCard[] = [
  { key: "spend", label: "Spend", format: "currency" },
  { key: "impressions", label: "Impressions", format: "number" },
  { key: "reach", label: "Reach", format: "number" },
  { key: "leads", label: "Leads", format: "number", intent: "good" },
  { key: "cpl", label: "CPL", format: "currency" },
  { key: "leadRate", label: "Lead/message", format: "percent" },
];

describe("deserializeCustomKpiSet", () => {
  it("falls back to the current pack KPIs when saved data is missing or invalid", () => {
    expect(deserializeCustomKpiSet(null, defaultKpis)).toEqual(["spend", "impressions", "reach", "leads", "cpl", "leadRate"]);
    expect(deserializeCustomKpiSet("not json", defaultKpis)).toEqual(["spend", "impressions", "reach", "leads", "cpl", "leadRate"]);
    expect(deserializeCustomKpiSet(JSON.stringify(["unknown"]), defaultKpis)).toEqual([
      "spend",
      "impressions",
      "reach",
      "leads",
      "cpl",
      "leadRate",
    ]);
  });

  it("drops invalid keys, removes duplicates, and preserves saved order", () => {
    expect(deserializeCustomKpiSet(JSON.stringify(["cpl", "unknown", "spend", "cpl", "replyRate"]), defaultKpis)).toEqual([
      "cpl",
      "spend",
      "replyRate",
    ]);
  });
});

describe("serializeCustomKpiSet", () => {
  it("serializes selected keys as JSON", () => {
    expect(serializeCustomKpiSet(["spend", "replyRate"])).toBe(JSON.stringify(["spend", "replyRate"]));
  });
});

describe("buildCustomKpiCards", () => {
  it("builds KPI cards in selection order and includes replyRate and leadRate", () => {
    expect(buildCustomKpiCards(["replyRate", "leadRate", "spend"])).toEqual([
      { key: "replyRate", label: "Reply rate", format: "percent" },
      { key: "leadRate", label: "Lead/message", format: "percent" },
      { key: "spend", label: "Spend", format: "currency" },
    ]);
  });
});

describe("getCustomKpiCatalogGroups", () => {
  it("groups selectable KPI-card metrics for the sheet", () => {
    const groups = getCustomKpiCatalogGroups("en");

    expect(groups.map((group) => group.label)).toContain("Messaging");
    expect(groups.flatMap((group) => group.metrics.map((metric) => metric.key))).toEqual(expect.arrayContaining(["replyRate", "leadRate"]));
  });
});
