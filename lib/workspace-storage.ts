import path from "node:path";

export function workspaceDataRoot(
  env: Record<string, string | undefined> = process.env,
) {
  return env.DECISION_WORKSPACE_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

export function workspaceDataPath(
  name: string,
  env: Record<string, string | undefined> = process.env,
) {
  return path.join(workspaceDataRoot(env), name);
}
