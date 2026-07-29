import { describe, expect, it } from "vitest";
import { getDefaultPromptStore, savePromptVersion } from "@/lib/prompt-store";
import { GET, POST } from "./route";

describe("AI prompt A/B test route", () => {
  it("creates, assigns, and records a prompt experiment", async () => {
    await savePromptVersion(getDefaultPromptStore(), { id: "control", useCase: "forecasting", template: "Control", variables: [], changelog: "control", active: true });
    await savePromptVersion(getDefaultPromptStore(), { id: "treatment", useCase: "forecasting", template: "Treatment", variables: [], changelog: "treatment", active: true });
    const create = await POST(new Request("http://localhost/api/ai/prompts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "create", id: "route-ab-test", useCase: "forecasting", controlPromptId: "control", treatmentPromptId: "treatment", metric: "task_success" }) }));
    expect(create.status).toBe(200);
    const assignment = await POST(new Request("http://localhost/api/ai/prompts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "assign", id: "route-ab-test", unitId: "unit-1" }) }));
    const assigned = (await assignment.json()).result;
    expect(assigned.promptId).toMatch(/^(control|treatment)$/u);
    const unassigned = await POST(new Request("http://localhost/api/ai/prompts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "result", id: "route-ab-test", unitId: "unit-2", value: 1 }) }));
    expect(unassigned.status).toBe(400);
    const result = await POST(new Request("http://localhost/api/ai/prompts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "result", id: "route-ab-test", unitId: "unit-1", value: 1 }) }));
    expect((await result.json()).result.winner).toBe(assigned.variant);
    const replacement = await POST(new Request("http://localhost/api/ai/prompts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "result", id: "route-ab-test", unitId: "unit-1", value: 0 }) }));
    expect((await replacement.json()).result.test.results).toHaveLength(1);
    expect((await GET()).json).toBeDefined();
  });
});
