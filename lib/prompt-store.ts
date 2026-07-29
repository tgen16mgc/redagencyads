import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { workspaceDataPath } from "@/lib/workspace-storage";
import { addPromptVersion, createPromptLibrary, summarizePromptTest, type PromptLibrary, type PromptTest, type PromptVersion } from "@/lib/prompt-library";

export type PromptStoreState = { library: PromptLibrary; tests: PromptTest[] };

export interface PromptStore {
  read(): Promise<PromptStoreState>;
  write(state: PromptStoreState): Promise<void>;
}

export class MemoryPromptStore implements PromptStore {
  private state: PromptStoreState = { library: createPromptLibrary(), tests: [] };
  async read() { return structuredClone(this.state); }
  async write(state: PromptStoreState) { this.state = structuredClone(state); }
}

export class JsonPromptStore implements PromptStore {
  constructor(private readonly filePath = process.env.PROMPT_LIBRARY_PATH || workspaceDataPath("prompt-library.json")) {}
  async read(): Promise<PromptStoreState> {
    try {
      const state = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<PromptStoreState>;
      return { library: createPromptLibrary(state.library), tests: Array.isArray(state.tests) ? state.tests : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { library: createPromptLibrary(), tests: [] };
      throw error;
    }
  }
  async write(state: PromptStoreState) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

let defaultStore: PromptStore | undefined;
export function getDefaultPromptStore() {
  if (!defaultStore) defaultStore = process.env.NODE_ENV === "test" ? new MemoryPromptStore() : new JsonPromptStore();
  return defaultStore;
}

export async function savePromptVersion(store: PromptStore, input: Omit<PromptVersion, "version" | "createdAt" | "active"> & { version?: number; active?: boolean }) {
  const state = await store.read();
  state.library = addPromptVersion(state.library, input);
  await store.write(state);
  return state.library;
}

function assignmentVariant(id: string, unitId: string) {
  let output = 0;
  const value = `${id}:${unitId}`;
  for (let index = 0; index < value.length; index += 1) output = (output * 31 + value.charCodeAt(index)) >>> 0;
  return output % 2 === 0 ? "control" as const : "treatment" as const;
}

export async function createStoredPromptTest(store: PromptStore, input: Omit<PromptTest, "assignments" | "results">) {
  const state = await store.read();
  if (input.controlPromptId === input.treatmentPromptId) throw new Error("Control and treatment prompt versions must be different.");
  const promptIds = new Set(state.library[input.useCase].map((prompt) => prompt.id));
  if (!promptIds.has(input.controlPromptId) || !promptIds.has(input.treatmentPromptId)) {
    throw new Error("Control and treatment prompts must exist in the selected use case.");
  }
  const test: PromptTest = { ...input, assignments: {}, results: [] };
  state.tests = [test, ...state.tests.filter((item) => item.id !== input.id)];
  await store.write(state);
  return test;
}

export async function assignStoredPromptTest(store: PromptStore, id: string, unitId: string) {
  const state = await store.read();
  const test = state.tests.find((item) => item.id === id);
  if (!test) throw new Error("Prompt test not found.");
  const variant = assignmentVariant(id, unitId);
  test.assignments[unitId] = variant;
  await store.write(state);
  return { variant, promptId: variant === "control" ? test.controlPromptId : test.treatmentPromptId };
}

export async function recordStoredPromptTestResult(store: PromptStore, id: string, unitId: string, value: number) {
  const state = await store.read();
  const test = state.tests.find((item) => item.id === id);
  if (!test) throw new Error("Prompt test not found.");
  const variant = test.assignments[unitId];
  if (!variant) throw new Error("Assign the unit before recording its result.");
  test.results = [...test.results.filter((item) => item.unitId !== unitId), { unitId, variant, value }];
  await store.write(state);
  return summarizePromptTest(test);
}

export async function listStoredPromptTests(store: PromptStore) {
  return (await store.read()).tests.map(summarizePromptTest);
}
