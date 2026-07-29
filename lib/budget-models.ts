import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { workspaceDataPath } from "@/lib/workspace-storage";
import type { SpendResponseCurve } from "@/lib/budget-allocator";
import {
  estimateBayesianHierarchicalSpendCurves,
  type HierarchicalCampaignDiagnostic,
} from "@/lib/budget-automation";
import type { CanonicalPerformanceRow } from "@/lib/cross-channel";
import { getDefaultPipelineStore, type PipelineStore } from "@/lib/data-pipeline";

export type BudgetModelSnapshot = {
  generatedAt: string;
  sourceUpdatedAt?: string;
  rowCount: number;
  curves: SpendResponseCurve[];
  diagnostics: HierarchicalCampaignDiagnostic[];
  model: ReturnType<
    typeof estimateBayesianHierarchicalSpendCurves
  >["model"];
};

export class JsonBudgetModelStore {
  constructor(private readonly filePath = process.env.BUDGET_MODEL_PATH || workspaceDataPath("budget-models.json")) {}

  async read(): Promise<BudgetModelSnapshot | null> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as BudgetModelSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async write(snapshot: BudgetModelSnapshot) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(snapshot, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

export function buildDailyBudgetModels(rows: CanonicalPerformanceRow[], now = new Date(), sourceUpdatedAt?: string): BudgetModelSnapshot {
  const ownedRows = rows.filter((row) => row.authority === "owned_performance" && row.campaignId);
  const byCampaignDate = new Map<string, CanonicalPerformanceRow[]>();
  for (const row of ownedRows) {
    const key = `${row.platform}:${row.campaignId}:${row.date}`;
    const bucket = byCampaignDate.get(key) || [];
    bucket.push(row);
    byCampaignDate.set(key, bucket);
  }
  const grainPriority: Record<CanonicalPerformanceRow["grain"], number> = { campaign: 0, ad_set: 1, ad: 2, creative: 3, daily: 4 };
  const campaignRows = [...byCampaignDate.values()].flatMap((bucket) => {
    const selectedPriority = Math.min(...bucket.map((row) => grainPriority[row.grain]));
    return bucket.filter((row) => grainPriority[row.grain] === selectedPriority);
  });
  const dailyGroups = new Map<string, { campaignId: string; platform: string; date: string; spend: number; revenue: number }>();
  for (const row of campaignRows) {
    const key = `${row.platform}:${row.campaignId}:${row.date}`;
    const current = dailyGroups.get(key) || { campaignId: row.campaignId!, platform: row.platform, date: row.date, spend: 0, revenue: 0 };
    current.spend += row.spend;
    current.revenue += row.revenue;
    dailyGroups.set(key, current);
  }
  const groups = new Map<string, { campaignId: string; platform: string; spend: number; revenue: number; observations: Array<{ date: string; spend: number; revenue: number }> }>();
  for (const observation of dailyGroups.values()) {
    const key = `${observation.platform}:${observation.campaignId}`;
    const current = groups.get(key) || { campaignId: observation.campaignId, platform: observation.platform, spend: 0, revenue: 0, observations: [] };
    current.spend += observation.spend;
    current.revenue += observation.revenue;
    current.observations.push({ date: observation.date, spend: observation.spend, revenue: observation.revenue });
    groups.set(key, current);
  }
  const estimate = estimateBayesianHierarchicalSpendCurves([...groups.values()]);
  return {
    generatedAt: now.toISOString(),
    sourceUpdatedAt,
    rowCount: campaignRows.length,
    curves: estimate.curves,
    diagnostics: estimate.diagnostics,
    model: estimate.model,
  };
}

export async function refreshDailyBudgetModels(input: { pipelineStore?: PipelineStore; modelStore?: JsonBudgetModelStore; now?: Date } = {}) {
  const pipeline = await (input.pipelineStore || getDefaultPipelineStore()).read();
  const snapshot = buildDailyBudgetModels(pipeline.performanceRows, input.now, pipeline.updatedAt);
  await (input.modelStore || new JsonBudgetModelStore()).write(snapshot);
  return snapshot;
}
