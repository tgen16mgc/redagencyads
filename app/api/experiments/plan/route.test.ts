import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/experiments/plan", () => {
  it("validates the wizard boundary and returns a plan", async () => {
    const response = await POST(new Request("http://localhost/api/experiments/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ definition: { id: "exp", hypothesis: "UGC wins", metric: "conversion_rate", baselineRate: 0.03, minimumDetectableEffect: 0.2, confidence: 0.95, power: 0.8, trafficAllocation: 0.5, assignmentUnit: "user", guardrails: ["CPA"], layer: "creative" }, observedDailyEligibleUsers: 1000 }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).plan.status).toBe("ready");
  });
});
