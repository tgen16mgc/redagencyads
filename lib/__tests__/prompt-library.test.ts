import { describe, expect, it } from "vitest";
import { activePrompt, addPromptVersion, AI_CHARTER, assignPromptTest, createPromptLibrary, createPromptTest, promptDiff, recordPromptTestResult, renderPrompt } from "@/lib/prompt-library";

describe("versioned prompt library", () => {
  it("activates one version per use case and renders variables", () => {
    let library = createPromptLibrary();
    library = addPromptVersion(library, { id: "copy-v1", useCase: "copy_generation", template: "Write for {{audience}}.", variables: ["audience"], changelog: "initial" });
    library = addPromptVersion(library, { id: "copy-v2", useCase: "copy_generation", template: "Write a short hook for {{audience}}.", variables: ["audience"], changelog: "add hook" });
    expect(activePrompt(library, "copy_generation")?.id).toBe("copy-v2");
    expect(renderPrompt(activePrompt(library, "copy_generation")!, { audience: "parents" })).toContain("parents");
    expect(promptDiff(library.copy_generation[1], library.copy_generation[0]).added.length).toBeGreaterThan(0);
  });

  it("defines the AI charter and A/B tests prompt versions", () => {
    expect(AI_CHARTER.map((item) => item.useCase)).toEqual(expect.arrayContaining(["copy_generation", "creative_brief", "performance_narration", "anomaly_detection", "forecasting"]));
    createPromptTest({ id: "prompt-test", useCase: "copy_generation", controlPromptId: "v1", treatmentPromptId: "v2", metric: "task_success" });
    const assignment = assignPromptTest("prompt-test", "user-1");
    expect(assignment.promptId).toMatch(/^v[12]$/u);
    expect(recordPromptTestResult("prompt-test", "user-1", 1).winner).toBe(assignment.variant);
  });

  it("treats lower edit distance as the winning prompt outcome", () => {
    createPromptTest({ id: "edit-distance-test", useCase: "copy_generation", controlPromptId: "v1", treatmentPromptId: "v2", metric: "edit_distance" });
    const units = Array.from({ length: 20 }, (_, index) => `unit-${index}`);
    const assignments = units.map((unitId) => ({ unitId, ...assignPromptTest("edit-distance-test", unitId) }));
    const controlUnit = assignments.find((item) => item.variant === "control")?.unitId;
    const treatmentUnit = assignments.find((item) => item.variant === "treatment")?.unitId;
    expect(controlUnit).toBeDefined();
    expect(treatmentUnit).toBeDefined();
    recordPromptTestResult("edit-distance-test", controlUnit!, 20);
    const result = recordPromptTestResult("edit-distance-test", treatmentUnit!, 10);
    expect(result.winner).toBe("treatment");
    expect(result.lift).toBe(0.5);
  });

  it("rejects unassigned units and replaces duplicate unit results", () => {
    createPromptTest({ id: "assignment-integrity-test", useCase: "forecasting", controlPromptId: "v1", treatmentPromptId: "v2", metric: "task_success" });
    expect(() => recordPromptTestResult("assignment-integrity-test", "unassigned", 1)).toThrow("Assign the unit");
    assignPromptTest("assignment-integrity-test", "workspace-1");
    recordPromptTestResult("assignment-integrity-test", "workspace-1", 0);
    const result = recordPromptTestResult("assignment-integrity-test", "workspace-1", 1);
    expect(result.test.results).toHaveLength(1);
    expect(result.test.results[0]).toMatchObject({ unitId: "workspace-1", value: 1 });
  });
});
