import path from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceDataPath, workspaceDataRoot } from "../workspace-storage";

describe("Decision Workspace storage paths", () => {
  it("defaults to the repository data directory", () => {
    expect(workspaceDataRoot({})).toBe(path.join(process.cwd(), ".data"));
    expect(workspaceDataPath("pipeline.json", {})).toBe(
      path.join(process.cwd(), ".data", "pipeline.json"),
    );
  });

  it("places every default store under the mounted production data root", () => {
    const env = { DECISION_WORKSPACE_DATA_DIR: "/var/lib/decision-workspace" };
    expect(workspaceDataRoot(env)).toBe("/var/lib/decision-workspace");
    expect(workspaceDataPath("creative-assets", env)).toBe(
      "/var/lib/decision-workspace/creative-assets",
    );
  });
});
