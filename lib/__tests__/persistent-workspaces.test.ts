import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { JsonExperimentLogStore, saveStoredExperiment, searchStoredExperiments } from "@/lib/experiment-log-store";
import { assignStoredExperiment, JsonExperimentAssignmentStore, releaseStoredExperiment } from "@/lib/experiment-assignment-store";
import { assignStoredPromptTest, createStoredPromptTest, JsonPromptStore, listStoredPromptTests, recordStoredPromptTestResult, savePromptVersion } from "@/lib/prompt-store";

describe("persistent AI and experiment workspaces", () => {
  it("persists prompt versions and A/B results", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "prompt-store-"));
    try {
      const store = new JsonPromptStore(path.join(directory, "prompts.json"));
      await savePromptVersion(store, { id: "copy-v1", useCase: "copy_generation", template: "Write {{offer}}", variables: ["offer"], changelog: "initial", active: true });
      await savePromptVersion(store, { id: "copy-v2", useCase: "copy_generation", template: "Write a concise {{offer}}", variables: ["offer"], changelog: "concise", active: true });
      await createStoredPromptTest(store, { id: "test-1", useCase: "copy_generation", controlPromptId: "copy-v1", treatmentPromptId: "copy-v2", metric: "task_success" });
      const assignment = await assignStoredPromptTest(store, "test-1", "workspace-1");
      await recordStoredPromptTestResult(store, "test-1", "workspace-1", 1);
      const reloaded = new JsonPromptStore(path.join(directory, "prompts.json"));
      expect((await reloaded.read()).library.copy_generation[0].id).toBe("copy-v2");
      expect((await listStoredPromptTests(reloaded))[0].winner).toBe(assignment.variant);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("persists searchable experiment learnings", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "experiment-store-"));
    try {
      const store = new JsonExperimentLogStore(path.join(directory, "experiments.json"));
      await saveStoredExperiment(store, { definition: { id: "ugc", hypothesis: "UGC beats studio", metric: "cpa", baselineRate: 0.04, minimumDetectableEffect: 0.2, confidence: 0.95, power: 0.8, trafficAllocation: 0.5, assignmentUnit: "user", guardrails: ["spend"], layer: "creative" } });
      expect(await searchStoredExperiments(new JsonExperimentLogStore(path.join(directory, "experiments.json")), "ugc")).toHaveLength(1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("persists mutually exclusive experiment-layer assignments until release", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "experiment-assignment-store-"));
    try {
      const filePath = path.join(directory, "assignments.json");
      const store = new JsonExperimentAssignmentStore(filePath);
      const first = await assignStoredExperiment(store, { experimentId: "exp-a", layer: "creative", unitId: "user-1", treatmentAllocation: 0.5 });
      expect((await assignStoredExperiment(new JsonExperimentAssignmentStore(filePath), { experimentId: "exp-a", layer: "creative", unitId: "user-1", treatmentAllocation: 0.5 })).variant).toBe(first.variant);
      await expect(assignStoredExperiment(new JsonExperimentAssignmentStore(filePath), { experimentId: "exp-b", layer: "creative", unitId: "user-1", treatmentAllocation: 0.5 })).rejects.toThrow("mutually exclusive");
      expect((await releaseStoredExperiment(store, "exp-a")).released).toBe(1);
      await expect(assignStoredExperiment(store, { experimentId: "exp-b", layer: "creative", unitId: "user-1", treatmentAllocation: 0.5 })).resolves.toMatchObject({ experimentId: "exp-b" });
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
