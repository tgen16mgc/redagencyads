import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { workspaceDataPath } from "@/lib/workspace-storage";

export type ActionAuditEntry = {
  id: string;
  action: string;
  target: string;
  status: "planned" | "deferred" | "applied" | "failed";
  requestedAt: string;
  appliedAt?: string;
  actor?: string;
  resumeWhen?: "learning_exit";
  details: Record<string, unknown>;
  error?: string;
};

export interface ActionAuditStore {
  read(): Promise<ActionAuditEntry[]>;
  write(entries: ActionAuditEntry[]): Promise<void>;
}

export class MemoryActionAuditStore implements ActionAuditStore {
  private entries: ActionAuditEntry[] = [];
  async read() { return structuredClone(this.entries); }
  async write(entries: ActionAuditEntry[]) { this.entries = structuredClone(entries); }
}

export class JsonActionAuditStore implements ActionAuditStore {
  private pendingWrite = Promise.resolve();

  constructor(private readonly filePath = process.env.ACTION_AUDIT_PATH || workspaceDataPath("action-audit.json")) {}

  async read() {
    await this.pendingWrite;
    try {
      const entries = JSON.parse(await readFile(this.filePath, "utf8"));
      return Array.isArray(entries) ? entries as ActionAuditEntry[] : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async write(entries: ActionAuditEntry[]) {
    const next = structuredClone(entries);
    this.pendingWrite = this.pendingWrite.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(next, null, 2), "utf8");
      await rename(temporaryPath, this.filePath);
    });
    await this.pendingWrite;
  }
}

let defaultStore: ActionAuditStore | undefined;
export function getDefaultActionAuditStore() {
  if (!defaultStore) defaultStore = process.env.NODE_ENV === "test" ? new MemoryActionAuditStore() : new JsonActionAuditStore();
  return defaultStore;
}

export async function recordAction(input: Omit<ActionAuditEntry, "id" | "requestedAt">, store = getDefaultActionAuditStore()) {
  const entries = await store.read();
  const entry: ActionAuditEntry = { ...input, id: `action:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, requestedAt: new Date().toISOString() };
  await store.write([entry, ...entries].slice(0, 2000));
  return entry;
}

export async function listActions(store = getDefaultActionAuditStore()) {
  return (await store.read()).slice();
}

export type DeferredBudgetAction = {
  entryId: string;
  platform: "meta" | "google_ads";
  targetId: string;
  campaignId?: string;
  budget: number;
};

function learningStillActive(status: string | undefined) {
  if (!status) return true;
  const normalized = status.toUpperCase();
  if (normalized === "NOT_LEARNING") return false;
  return (
    normalized === "UNKNOWN" ||
    normalized === "UNSPECIFIED" ||
    normalized === "PENDING" ||
    normalized === "MISCONFIGURED" ||
    normalized === "UNAVAILABLE" ||
    normalized.includes("LEARNING")
  );
}

export async function processDeferredBudgetActions(input: {
  store?: ActionAuditStore;
  getLearningStatus: (
    action: DeferredBudgetAction,
  ) => Promise<string | undefined>;
  applyBudget: (action: DeferredBudgetAction) => Promise<void>;
}) {
  const store = input.store || getDefaultActionAuditStore();
  const entries = await store.read();
  const processed: ActionAuditEntry[] = [];
  let changed = false;
  for (const entry of entries) {
    if (entry.status !== "deferred" || !["budget_change", "pacing_budget_change"].includes(entry.action) || entry.resumeWhen !== "learning_exit") continue;
    const platform = entry.details.platform;
    const budget = entry.action === "pacing_budget_change" ? entry.details.recommendedDailyBudget : entry.details.budget;
    if ((platform !== "meta" && platform !== "google_ads") || typeof budget !== "number") continue;
    const campaignId = typeof entry.details.campaignId === "string"
      ? entry.details.campaignId
      : undefined;
    if (platform === "google_ads" && !campaignId) {
      entry.error = "A Google Ads campaign ID is required to inspect learning state before resume.";
      changed = true;
      continue;
    }
    const action: DeferredBudgetAction = {
      entryId: entry.id,
      platform,
      targetId: entry.target,
      campaignId,
      budget,
    };
    try {
      const learningStatus = await input.getLearningStatus(action);
      if (learningStillActive(learningStatus)) continue;
      await input.applyBudget(action);
      entry.status = "applied";
      entry.appliedAt = new Date().toISOString();
      entry.error = undefined;
      processed.push(structuredClone(entry));
      changed = true;
    } catch (error) {
      entry.error = error instanceof Error ? error.message : "Deferred budget action failed.";
      entry.details = {
        ...entry.details,
        resumeAttempts:
          (typeof entry.details.resumeAttempts === "number"
            ? entry.details.resumeAttempts
            : 0) + 1,
        lastResumeAttemptAt: new Date().toISOString(),
      };
      processed.push(structuredClone(entry));
      changed = true;
    }
  }
  if (changed) await store.write(entries);
  return { processed, deferredRemaining: entries.filter((entry) => entry.status === "deferred").length };
}
