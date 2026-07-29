import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { workspaceDataPath } from "@/lib/workspace-storage";
import { assignExperiment, type ExperimentAssignment } from "@/lib/experiment-engine";

export type StoredExperimentAssignment = ExperimentAssignment & { releasedAt?: string };

export interface ExperimentAssignmentStore {
  read(): Promise<StoredExperimentAssignment[]>;
  write(assignments: StoredExperimentAssignment[]): Promise<void>;
}

export class MemoryExperimentAssignmentStore implements ExperimentAssignmentStore {
  private assignments: StoredExperimentAssignment[] = [];
  async read() { return structuredClone(this.assignments); }
  async write(assignments: StoredExperimentAssignment[]) { this.assignments = structuredClone(assignments); }
}

export class JsonExperimentAssignmentStore implements ExperimentAssignmentStore {
  private pendingWrite = Promise.resolve();

  constructor(private readonly filePath = process.env.EXPERIMENT_ASSIGNMENT_PATH || workspaceDataPath("experiment-assignments.json")) {}

  async read() {
    await this.pendingWrite;
    try {
      const assignments = JSON.parse(await readFile(this.filePath, "utf8"));
      return Array.isArray(assignments) ? assignments as StoredExperimentAssignment[] : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async write(assignments: StoredExperimentAssignment[]) {
    const next = structuredClone(assignments);
    this.pendingWrite = this.pendingWrite.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(next, null, 2), "utf8");
      await rename(temporaryPath, this.filePath);
    });
    await this.pendingWrite;
  }
}

let defaultStore: ExperimentAssignmentStore | undefined;
export function getDefaultExperimentAssignmentStore() {
  if (!defaultStore) defaultStore = process.env.NODE_ENV === "test" ? new MemoryExperimentAssignmentStore() : new JsonExperimentAssignmentStore();
  return defaultStore;
}

export async function assignStoredExperiment(store: ExperimentAssignmentStore, input: {
  experimentId: string;
  layer: string;
  unitId: string;
  treatmentAllocation: number;
  trafficAllocation?: number;
}) {
  const assignments = await store.read();
  const existing = assignments.find((assignment) => !assignment.releasedAt
    && assignment.experimentId === input.experimentId
    && assignment.layer === input.layer
    && assignment.unitId === input.unitId);
  if (existing) return existing;
  const activeAssignments = assignments.filter((assignment) => !assignment.releasedAt);
  const assignment = assignExperiment({ ...input, activeAssignments });
  await store.write([assignment, ...assignments].slice(0, 50_000));
  return assignment;
}

export async function releaseStoredExperiment(store: ExperimentAssignmentStore, experimentId: string) {
  const assignments = await store.read();
  const releasedAt = new Date().toISOString();
  let released = 0;
  const next = assignments.map((assignment) => {
    if (assignment.experimentId !== experimentId || assignment.releasedAt) return assignment;
    released += 1;
    return { ...assignment, releasedAt };
  });
  if (released) await store.write(next);
  return { experimentId, released, releasedAt: released ? releasedAt : undefined };
}
