import { describe, expect, it } from "vitest";
import { GET as getActions } from "./actions/route";
import { POST as consolidateAudience } from "./audience/consolidate/route";
import { GET as getIncrementality, POST as saveIncrementality } from "./incrementality/route";

describe("intelligence operation routes", () => {
  it("persists incrementality studies and returns the latest study", async () => {
    const response = await saveIncrementality(new Request("http://localhost/api/intelligence/incrementality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "geo-2026-07", method: "geo_lift", startDate: "2026-07-01", endDate: "2026-07-21", lift: 0.14, confidenceLower: 0.08, confidenceUpper: 0.2 }) }));
    expect(response.status).toBe(200);
    const list = await (await getIncrementality()).json();
    expect(list.latest).toMatchObject({ id: "geo-2026-07", lift: 0.14 });
  });

  it("rejects inverted incrementality windows", async () => {
    const response = await saveIncrementality(new Request("http://localhost/api/intelligence/incrementality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "invalid", method: "psa", startDate: "2026-07-20", endDate: "2026-07-01", lift: 0.1 }) }));
    expect(response.status).toBe(400);
  });

  it("records audience consolidation as a dry-run action without touching Ads Manager", async () => {
    const response = await consolidateAudience(new Request("http://localhost/api/intelligence/audience/consolidate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "exclude", leftId: "adset-a", rightId: "adset-b", overlap: 0.6, apply: false }) }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.audit).toMatchObject({ action: "audience_exclude", target: "adset-b", status: "planned" });
    const actions = await (await getActions()).json();
    expect(actions.actions.some((item: { id: string }) => item.id === body.audit.id)).toBe(true);
  });

  it("fails closed when an audience write is unsupported or lacks an explicit targeting payload", async () => {
    const merge = await consolidateAudience(new Request("http://localhost/api/intelligence/audience/consolidate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "merge", leftId: "adset-a", rightId: "adset-b", overlap: 0.6, apply: true }) }));
    expect(merge.status).toBe(501);
    const exclusion = await consolidateAudience(new Request("http://localhost/api/intelligence/audience/consolidate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "exclude", leftId: "adset-a", rightId: "adset-b", overlap: 0.6, apply: true }) }));
    expect(exclusion.status).toBe(400);
  });
});
