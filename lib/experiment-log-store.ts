import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { workspaceDataPath } from "@/lib/workspace-storage";
import { learningTags, type ExperimentDefinition, type ExperimentLogEntry, type ExperimentResultDashboard } from "@/lib/experiment-engine";

export interface ExperimentLogStore {
  read(): Promise<ExperimentLogEntry[]>;
  write(entries: ExperimentLogEntry[]): Promise<void>;
}

export class MemoryExperimentLogStore implements ExperimentLogStore {
  private entries: ExperimentLogEntry[] = [];
  async read() { return structuredClone(this.entries); }
  async write(entries: ExperimentLogEntry[]) { this.entries = structuredClone(entries); }
}

export class JsonExperimentLogStore implements ExperimentLogStore {
  constructor(private readonly filePath = process.env.EXPERIMENT_LOG_PATH || workspaceDataPath("experiment-log.json")) {}
  async read() {
    try {
      const entries = JSON.parse(await readFile(this.filePath, "utf8"));
      return Array.isArray(entries) ? entries as ExperimentLogEntry[] : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async write(entries: ExperimentLogEntry[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(entries, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

let defaultStore: ExperimentLogStore | undefined;
export function getDefaultExperimentLogStore() {
  if (!defaultStore) defaultStore = process.env.NODE_ENV === "test" ? new MemoryExperimentLogStore() : new JsonExperimentLogStore();
  return defaultStore;
}

export async function saveStoredExperiment(store: ExperimentLogStore, input: { definition: ExperimentDefinition; result?: ExperimentResultDashboard }) {
  const entries = await store.read();
  const now = new Date().toISOString();
  const existing = entries.find((entry) => entry.id === input.definition.id);
  const lift = input.result ? `${Math.abs(input.result.lift * 100).toFixed(1)}%` : undefined;
  const learning = input.result ? `${input.definition.hypothesis}: ${input.result.recommendation} with ${lift} ${input.result.lift >= 0 ? "lift" : "decline"}.` : undefined;
  const entry: ExperimentLogEntry = { id: input.definition.id, definition: input.definition, result: input.result, tags: learningTags(input.definition, input.result), learning, createdAt: existing?.createdAt || now, updatedAt: now };
  await store.write([entry, ...entries.filter((item) => item.id !== entry.id)].slice(0, 1000));
  return entry;
}

export async function searchStoredExperiments(store: ExperimentLogStore, query = "") {
  const needle = query.trim().toLocaleLowerCase();
  return (await store.read()).filter((entry) => !needle || `${entry.definition.hypothesis} ${entry.learning || ""} ${entry.tags.join(" ")}`.toLocaleLowerCase().includes(needle));
}
