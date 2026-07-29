import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { workspaceDataPath } from "@/lib/workspace-storage";
import type { IncrementalityStudy } from "@/lib/cross-channel";

export interface IncrementalityStore {
  read(): Promise<IncrementalityStudy[]>;
  write(studies: IncrementalityStudy[]): Promise<void>;
}

export class MemoryIncrementalityStore implements IncrementalityStore {
  private studies: IncrementalityStudy[] = [];
  async read() { return structuredClone(this.studies); }
  async write(studies: IncrementalityStudy[]) { this.studies = structuredClone(studies); }
}

export class JsonIncrementalityStore implements IncrementalityStore {
  private pendingWrite = Promise.resolve();
  constructor(private readonly filePath = process.env.INCREMENTALITY_PATH || workspaceDataPath("incrementality.json")) {}
  async read() {
    await this.pendingWrite;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      return Array.isArray(parsed) ? parsed as IncrementalityStudy[] : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async write(studies: IncrementalityStudy[]) {
    const next = structuredClone(studies);
    this.pendingWrite = this.pendingWrite.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(next, null, 2), "utf8");
      await rename(temporaryPath, this.filePath);
    });
    await this.pendingWrite;
  }
}

let defaultStore: IncrementalityStore | undefined;
export function getDefaultIncrementalityStore() {
  if (!defaultStore) defaultStore = process.env.NODE_ENV === "test" ? new MemoryIncrementalityStore() : new JsonIncrementalityStore();
  return defaultStore;
}

export async function saveIncrementalityStudy(study: IncrementalityStudy, store = getDefaultIncrementalityStore()) {
  const studies = await store.read();
  const index = studies.findIndex((item) => item.id === study.id);
  if (index >= 0) studies[index] = study;
  else studies.unshift(study);
  await store.write(studies.slice(0, 1000));
  return study;
}

export async function listIncrementalityStudies(store = getDefaultIncrementalityStore()) {
  return store.read();
}

export async function latestIncrementalityStudy(store = getDefaultIncrementalityStore()) {
  return (await store.read()).sort((left, right) => right.endDate.localeCompare(left.endDate))[0];
}
