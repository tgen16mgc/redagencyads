import { describe, expect, it } from "vitest";
import { buildSampleReport } from "../sample-report";
import { funnelBreakdownRows, funnelRowKey, funnelRowLabel, funnelValueChange, matchFunnelBaseline } from "../funnel-analysis";
import { buildFunnelObservation, funnelObservationKey, funnelScopeKey, parseFunnelBriefs, parseFunnelPlannerDraft, type FunnelPlannerDraft, type FunnelTestBrief } from "../funnel-investigation";

const fixture = () => buildSampleReport({ pack: "messages" });

describe("funnel outcome and segment comparisons", () => {
  it("distinguishes tracked zero baselines from unavailable and nonfinite values", () => {
    expect(funnelValueChange(10, 0)).toEqual({ absolute: 10, relative: null });
    expect(funnelValueChange(0, 10)).toEqual({ absolute: -10, relative: -100 });
    expect(funnelValueChange(15, 10)).toEqual({ absolute: 5, relative: 50 });
    expect(funnelValueChange(null, 10)).toBeNull();
    expect(funnelValueChange(10, null)).toBeNull();
    expect(funnelValueChange(Infinity, 10)).toBeNull();
  });

  it("matches reordered platform rows by dimensions despite index ID reuse", () => {
    const [facebook, instagram] = fixture().platformRows;
    const baseline = [{ ...instagram, id: facebook.id }, { ...facebook, id: instagram.id }];
    expect(matchFunnelBaseline(facebook, baseline, "platform")?.platform).toBe("facebook");
    expect(matchFunnelBaseline(facebook, baseline, "platform")?.id).toBe(instagram.id);
    expect(matchFunnelBaseline({ ...facebook, platform: "new_platform" }, baseline, "platform")).toBeNull();
  });

  it("does not use shared display names or missing dimension values as a match", () => {
    const row = fixture().adRows[0];
    expect(matchFunnelBaseline(row, [{ ...row, id: "different-id" }], "ad")).toBeNull();
    expect(matchFunnelBaseline({ ...row, platform: undefined }, [row], "platform")).toBeNull();
    expect(funnelRowKey({ ...row, age: "25-34", gender: undefined }, "ageGender")).toBeNull();
  });

  it("rejects ambiguous baseline tuples and distinguishes country and placement", () => {
    const row = fixture().regionRows[0];
    expect(matchFunnelBaseline(row, [row, { ...row, id: "duplicate" }], "region")).toBeNull();
    expect(matchFunnelBaseline({ ...row, country: "US" }, [{ ...row, country: "CA" }], "region")).toBeNull();
    const platform = fixture().platformRows[0];
    expect(matchFunnelBaseline({ ...platform, placement: "feed" }, [{ ...platform, placement: "reels" }], "platform")).toBeNull();
  });

  it("uses canonical age and gender rather than the generic API row name", () => {
    const row = fixture().ageGenderRows[1];
    expect(funnelRowLabel({ ...row, name: "Account total" }, "ageGender", "en")).toBe("25-34 · female");
    expect(funnelRowLabel(row, "ageGender", "vi")).toBe("25-34 · Nữ");
    expect(funnelRowKey({ ...row, gender: " FEMALE " }, "ageGender")).toBe(funnelRowKey(row, "ageGender"));
  });

  it("does not manufacture observed device rows from ad-set targeting", () => {
    expect(funnelBreakdownRows(fixture(), "device")).toEqual([]);
  });
});

describe("funnel investigation evidence", () => {
  it("snapshots the selected segment with a correctly matched baseline", () => {
    const report = fixture();
    const previous = structuredClone(report);
    previous.platformRows.reverse();
    previous.platformRows[0].id = report.platformRows[0].id;
    const row = report.platformRows[0];
    const observation = buildFunnelObservation(report, previous, "previous", "conversations", "platform", row);
    expect(observation.segment?.key).toBe(funnelRowKey(row, "platform"));
    expect(observation.baseline?.value).toBe(row.messages);
    const value = observation.current.value;
    row.messages += 200;
    report.dateRange.since = "2020-01-01";
    expect(observation.current.value).toBe(value);
    expect(observation.dates.since).not.toBe("2020-01-01");
  });

  it("withholds disabled, wrong-account, wrong-currency and unmatched comparisons", () => {
    const report = fixture();
    const wrongAccount = { ...report, account: { ...report.account, id: "another-account" } };
    const wrongCurrency = { ...report, account: { ...report.account, currency: "USD" } };
    for (const [previous, mode] of [[report, "off"], [wrongAccount, "previous"], [wrongCurrency, "previous"]] as const) {
      expect(buildFunnelObservation(report, previous, mode, "conversations", "ad", null).baseline).toBeNull();
    }
    const observation = buildFunnelObservation(report, { ...report, adRows: [] }, "previous", "conversations", "ad", report.adRows[0]);
    expect(observation.baseline).toBeNull();
  });

  it("keeps drafts distinct when stage, segment, evidence or comparison changes", () => {
    const report = fixture();
    const base = buildFunnelObservation(report, report, "previous", "conversations", "platform", null);
    const key = funnelObservationKey(base);
    expect(funnelObservationKey({ ...base, stage: "traffic" })).not.toBe(key);
    expect(funnelObservationKey({ ...base, segment: { key: "facebook", name: "facebook" } })).not.toBe(key);
    expect(funnelObservationKey({ ...base, current: { ...base.current, value: 900 } })).not.toBe(key);
    expect(funnelScopeKey(report, report, "off")).not.toBe(base.scopeKey);
    expect(funnelScopeKey({ ...report, source: "meta_api" }, report, "previous")).not.toBe(base.scopeKey);
  });

  it("restores only valid saved revisions belonging to the current scope", () => {
    const report = fixture();
    const observation = buildFunnelObservation(report, null, "off", "lead", "ad", null);
    const brief: FunnelTestBrief = { version: 1, id: "saved-1", createdAt: "2026-10-17T01:00:00Z", observation, draft: { hypothesis: "A possible explanation", change: "One proposed change", guardrails: "spend, quality", metric: "cost_per_lead" } };
    expect(parseFunnelBriefs(JSON.stringify([brief]), observation.scopeKey)).toEqual([brief]);
    expect(parseFunnelBriefs(JSON.stringify([brief]), "different-scope")).toEqual([]);
    for (const raw of [null, "broken", "null", "{}", "[null]", JSON.stringify([{ ...brief, draft: {} }]), JSON.stringify([{ ...brief, observation: { ...observation, current: {} } }])]) {
      expect(parseFunnelBriefs(raw, observation.scopeKey)).toEqual([]);
    }
    expect(parseFunnelBriefs(JSON.stringify(Array.from({ length: 10 }, () => brief)), observation.scopeKey)).length(8);
  });

  it("restores incomplete planner input independently of immutable evidence and rejects wrong brief IDs", () => {
    const draft: FunnelPlannerDraft = {
      version: 1, briefId: "saved-1", dailyUnits: 0, measurementDefinition: "",
      definition: { id: "plan-1", hypothesis: "Possible explanation", metric: "cpa", baselineRate: 0, baselineStandardDeviation: 0, minimumDetectableEffect: 0.2, confidence: 0.95, power: 0.8, trafficAllocation: 0.5, assignmentUnit: "user", guardrails: ["spend"], layer: "funnel-lead" },
    };
    expect(parseFunnelPlannerDraft(JSON.stringify(draft), "saved-1")).toEqual(draft);
    expect(parseFunnelPlannerDraft(JSON.stringify(draft), "other-brief")).toBeNull();
    for (const raw of [null, "broken", "null", "{}", JSON.stringify({ ...draft, definition: null }), JSON.stringify({ ...draft, dailyUnits: "500" }), JSON.stringify({ ...draft, definition: { ...draft.definition, guardrails: null } })]) {
      expect(parseFunnelPlannerDraft(raw, "saved-1")).toBeNull();
    }
  });
});
