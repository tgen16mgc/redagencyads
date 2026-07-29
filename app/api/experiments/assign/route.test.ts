import { describe, expect, it } from "vitest";
import { DELETE, POST } from "./route";

function request(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://localhost/api/experiments/assign", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("experiment assignment route", () => {
  it("enforces layer exclusion across requests and releases ended experiments", async () => {
    const unitId = `route-user-${Date.now()}`;
    const first = await POST(request("POST", { experimentId: "route-exp-a", layer: "creative-route", unitId, treatmentAllocation: 0.5 }));
    expect(first.status).toBe(200);

    const conflict = await POST(request("POST", { experimentId: "route-exp-b", layer: "creative-route", unitId, treatmentAllocation: 0.5 }));
    expect(conflict.status).toBe(400);
    expect((await conflict.json()).error).toContain("mutually exclusive");

    const released = await DELETE(request("DELETE", { experimentId: "route-exp-a" }));
    expect((await released.json()).release.released).toBe(1);

    const reassigned = await POST(request("POST", { experimentId: "route-exp-b", layer: "creative-route", unitId, treatmentAllocation: 0.5 }));
    expect(reassigned.status).toBe(200);
  });
});
