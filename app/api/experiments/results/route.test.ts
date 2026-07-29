import { describe, expect, it } from "vitest";
import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/experiments/results", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/experiments/results", () => {
  it("evaluates binary success counts", async () => {
    const response = await POST(
      request({
        metric: "conversion_rate",
        controlSuccesses: 400,
        controlSamples: 10000,
        treatmentSuccesses: 520,
        treatmentSamples: 10000,
        relativeMde: 0.1,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      dashboard: { metricFamily: "binary", recommendation: "ship" },
      sequential: { method: "one_sided_normal_mixture_msprt" },
    });
  });

  it("evaluates continuous CPA samples using means and variance", async () => {
    const response = await POST(
      request({
        metric: "cpa",
        controlMean: 50,
        controlStandardDeviation: 20,
        controlSamples: 1000,
        treatmentMean: 45,
        treatmentStandardDeviation: 20,
        treatmentSamples: 1000,
        relativeMde: 0.2,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      dashboard: {
        metricFamily: "continuous",
        metricDirection: "lower",
        recommendation: "ship",
      },
      sequential: { recommendation: "ship" },
    });
  });

  it("rejects binary-shaped data for a continuous metric", async () => {
    const response = await POST(
      request({
        metric: "cpa",
        controlSuccesses: 10,
        controlSamples: 100,
        treatmentSuccesses: 12,
        treatmentSamples: 100,
        relativeMde: 0.1,
      }),
    );
    expect(response.status).toBe(400);
  });
});
