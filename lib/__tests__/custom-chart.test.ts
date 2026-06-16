import { describe, expect, it } from "vitest";
import type { ChartKey } from "../chart-spec";
import type { NormalizedRow } from "../types";
import {
  CHART_PRESETS,
  CUSTOM_CHARTS_STORAGE_KEY,
  MAX_SERIES,
  METRIC_CATALOG,
  type CustomChartSpec,
  addSeries,
  axisFormatFor,
  buildChartConfig,
  buildCustomChartData,
  canAddSeries,
  defaultAxisFor,
  deserializeCharts,
  getMetricCatalog,
  getPresets,
  metricFormat,
  metricLabel,
  normalizeSpec,
  presetToSpec,
  removeSeries,
  serializeCharts,
  setSeriesAxis,
  validateSpec,
} from "../custom-chart";

const ALL_CHART_KEYS: ChartKey[] = [
  "messages",
  "replies",
  "leads",
  "purchases",
  "linkClicks",
  "clicks",
  "impressions",
  "reach",
  "costPerMessage",
  "costPerReply",
  "cpl",
  "cpaPurchase",
  "cpc",
  "cpm",
  "roas",
  "ctr",
  "frequency",
];

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "daily",
    name: "Row",
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    linkClicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    messages: 0,
    replies: 0,
    leads: 0,
    purchases: 0,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: 0,
    costPerReply: 0,
    cpl: 0,
    cpaPurchase: 0,
    roas: 0,
    replyRate: 0,
    leadRate: 0,
    ...overrides,
  };
}

function spec(overrides: Partial<CustomChartSpec>): CustomChartSpec {
  return {
    id: "c1",
    title: "Chart",
    type: "composed",
    xKey: "date",
    series: [],
    dualAxis: false,
    ...overrides,
  };
}

describe("metric catalog", () => {
  it("covers exactly the 17 chart keys", () => {
    expect(METRIC_CATALOG).toHaveLength(ALL_CHART_KEYS.length);
    expect(new Set(METRIC_CATALOG.map((e) => e.key))).toEqual(new Set(ALL_CHART_KEYS));
  });

  it("assigns left axis to number/currency and right to percent/ratio", () => {
    expect(defaultAxisFor("leads")).toBe("left");
    expect(defaultAxisFor("cpl")).toBe("left");
    expect(defaultAxisFor("ctr")).toBe("right");
    expect(defaultAxisFor("roas")).toBe("right");
  });

  it("resolves labels by language", () => {
    expect(metricLabel("leads", "en")).toBe("Leads");
    expect(metricLabel("leads", "vi")).toBe("Lead");
    expect(getMetricCatalog("vi").find((e) => e.key === "messages")?.label).toBe("Tin nhắn");
  });

  it("maps each key to a known format", () => {
    expect(metricFormat("cpl")).toBe("currency");
    expect(metricFormat("ctr")).toBe("percent");
    expect(metricFormat("roas")).toBe("ratio");
    expect(metricFormat("leads")).toBe("number");
  });
});

describe("validateSpec", () => {
  it("flags EMPTY_SERIES", () => {
    const result = validateSpec(spec({ series: [] }));
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("EMPTY_SERIES");
  });

  it("flags TOO_MANY_SERIES on a raw over-cap spec", () => {
    const series = ALL_CHART_KEYS.slice(0, 6).map((key) => ({ key, axis: "left" as const }));
    const codes = validateSpec(spec({ series })).issues.map((i) => i.code);
    expect(codes).toContain("TOO_MANY_SERIES");
  });

  it("flags DUPLICATE_SERIES on a raw spec with repeats", () => {
    const codes = validateSpec(
      spec({ series: [{ key: "leads", axis: "left" }, { key: "leads", axis: "left" }] }),
    ).issues.map((i) => i.code);
    expect(codes).toContain("DUPLICATE_SERIES");
  });

  it("flags TOO_MANY_FORMATS when three formats are present", () => {
    const codes = validateSpec(
      spec({
        dualAxis: true,
        series: [
          { key: "leads", axis: "left" },
          { key: "cpl", axis: "left" },
          { key: "ctr", axis: "right" },
        ],
      }),
    ).issues.map((i) => i.code);
    expect(codes).toContain("TOO_MANY_FORMATS");
  });

  it("flags MIXED_FORMATS_SINGLE_AXIS when one axis hosts two formats", () => {
    const codes = validateSpec(
      spec({ series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "left" }] }),
    ).issues.map((i) => i.code);
    expect(codes).toContain("MIXED_FORMATS_SINGLE_AXIS");
  });

  it("flags DUAL_AXIS_UNNEEDED on a raw single-format dual-axis spec", () => {
    const codes = validateSpec(
      spec({ dualAxis: true, series: [{ key: "leads", axis: "left" }] }),
    ).issues.map((i) => i.code);
    expect(codes).toContain("DUAL_AXIS_UNNEEDED");
  });

  it("passes a clean two-format axis-split spec", () => {
    const result = validateSpec(
      spec({ dualAxis: true, series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "right" }] }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("normalizeSpec", () => {
  it("dedupes identical key+axis pairs", () => {
    const result = normalizeSpec(spec({ series: [{ key: "leads", axis: "left" }, { key: "leads", axis: "left" }] }));
    expect(result.series).toHaveLength(1);
  });

  it("keeps the same key on different axes", () => {
    const result = normalizeSpec(spec({ series: [{ key: "leads", axis: "left" }, { key: "leads", axis: "right" }] }));
    expect(result.series).toHaveLength(2);
  });

  it("clamps to the series cap", () => {
    const series = ALL_CHART_KEYS.slice(0, 7).map((key) => ({ key, axis: "left" as const }));
    expect(normalizeSpec(spec({ series })).series).toHaveLength(MAX_SERIES);
  });

  it("drops unknown keys", () => {
    const result = normalizeSpec(spec({ series: [{ key: "leads", axis: "left" }, { key: "bogus" as ChartKey, axis: "left" }] }));
    expect(result.series).toEqual([{ key: "leads", axis: "left" }]);
  });

  it("auto-enables dualAxis at exactly two formats and disables otherwise", () => {
    expect(normalizeSpec(spec({ series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "right" }] })).dualAxis).toBe(true);
    expect(normalizeSpec(spec({ dualAxis: true, series: [{ key: "leads", axis: "left" }] })).dualAxis).toBe(false);
  });

  it("fills a blank title from series labels", () => {
    expect(normalizeSpec(spec({ title: "  ", series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "right" }] })).title).toBe("Leads vs CPL");
  });
});

describe("mutators", () => {
  it("addSeries is immutable and fills the default axis", () => {
    const base = spec({ series: [] });
    const next = addSeries(base, "ctr");
    expect(base.series).toHaveLength(0);
    expect(next.series).toEqual([{ key: "ctr", axis: "right" }]);
  });

  it("canAddSeries is false at the cap", () => {
    const series = ALL_CHART_KEYS.slice(0, MAX_SERIES).map((key) => ({ key, axis: "left" as const }));
    expect(canAddSeries(spec({ series }))).toBe(false);
  });

  it("removeSeries drops the matching key", () => {
    const base = spec({ series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "right" }] });
    expect(removeSeries(base, "leads").series).toEqual([{ key: "cpl", axis: "right" }]);
  });

  it("setSeriesAxis moves a series and re-evaluates dualAxis", () => {
    const base = normalizeSpec(spec({ series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "right" }] }));
    const moved = setSeriesAxis(base, "cpl", "left");
    expect(moved.series.find((s) => s.key === "cpl")?.axis).toBe("left");
  });
});

describe("buildCustomChartData", () => {
  it("returns an empty array for no rows", () => {
    expect(buildCustomChartData([], spec({ series: [{ key: "leads", axis: "left" }] }))).toEqual([]);
  });

  it("skips rows without a date", () => {
    const rows = [row({ date: undefined, leads: 5 }), row({ date: "2026-06-05", leads: 9 })];
    const data = buildCustomChartData(rows, spec({ series: [{ key: "leads", axis: "left" }] }));
    expect(data).toEqual([{ x: "5/6", leads: 9 }]);
  });

  it("rounds each series by its format", () => {
    const rows = [row({ date: "2026-06-05", leads: 12.7, roas: 2.345 })];
    const [point] = buildCustomChartData(rows, spec({ series: [{ key: "leads", axis: "left" }, { key: "roas", axis: "right" }] }));
    expect(point.leads).toBe(13);
    expect(point.roas).toBe(2.35);
  });
});

describe("buildChartConfig", () => {
  it("assigns palette colors in series order", () => {
    const config = buildChartConfig(spec({ series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "right" }] }), "en");
    expect(config.leads.color).toBe("var(--chart-1)");
    expect(config.cpl.color).toBe("var(--chart-2)");
    expect(config.leads.label).toBe("Leads");
  });

  it("axisFormatFor reports the format on each axis", () => {
    const s = normalizeSpec(spec({ series: [{ key: "leads", axis: "left" }, { key: "ctr", axis: "right" }] }));
    expect(axisFormatFor(s, "left")).toBe("number");
    expect(axisFormatFor(s, "right")).toBe("percent");
  });
});

describe("presets", () => {
  it("every preset produces a valid spec", () => {
    for (const preset of CHART_PRESETS) {
      const result = validateSpec(presetToSpec(preset, "en", `id-${preset.id}`));
      expect(result.ok, `${preset.id}: ${result.issues.map((i) => i.code).join(", ")}`).toBe(true);
    }
  });

  it("presetToSpec carries the caller id and localized title", () => {
    const preset = CHART_PRESETS[0];
    const s = presetToSpec(preset, "vi", "my-id");
    expect(s.id).toBe("my-id");
    expect(s.title).toBe(preset.nameVi);
  });

  it("getPresets localizes name, usage, and meaning", () => {
    const en = getPresets("en")[0];
    const vi = getPresets("vi")[0];
    expect(en.name).toBe(CHART_PRESETS[0].nameEn);
    expect(vi.meaning).toBe(CHART_PRESETS[0].meaningVi);
  });
});

describe("persistence", () => {
  it("round-trips valid specs", () => {
    const specs = [normalizeSpec(spec({ series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "right" }] }))];
    expect(deserializeCharts(serializeCharts(specs))).toEqual(specs);
  });

  it("returns an empty array on garbage and non-arrays", () => {
    expect(deserializeCharts("not json")).toEqual([]);
    expect(deserializeCharts("{}")).toEqual([]);
    expect(deserializeCharts(null)).toEqual([]);
  });

  it("drops an entry with an unknown chart key but keeps valid siblings", () => {
    const valid = normalizeSpec(spec({ id: "ok", series: [{ key: "leads", axis: "left" }, { key: "cpl", axis: "right" }] }));
    const raw = JSON.stringify([
      valid,
      { id: "bad", title: "x", type: "line", xKey: "date", dualAxis: false, series: [{ key: "ghost", axis: "left" }] },
    ]);
    const result = deserializeCharts(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ok");
  });

  it("drops an entry that fails validation", () => {
    const raw = JSON.stringify([
      { id: "empty", title: "x", type: "line", xKey: "date", dualAxis: false, series: [] },
    ]);
    expect(deserializeCharts(raw)).toEqual([]);
  });

  it("drops an entry with a blank id", () => {
    const raw = JSON.stringify([
      { id: "", title: "x", type: "line", xKey: "date", dualAxis: false, series: [{ key: "leads", axis: "left" }] },
    ]);
    expect(deserializeCharts(raw)).toEqual([]);
  });

  it("exposes a stable storage key", () => {
    expect(CUSTOM_CHARTS_STORAGE_KEY).toBe("redagencyads-custom-charts");
  });
});
