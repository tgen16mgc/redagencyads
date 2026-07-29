import { NextResponse } from "next/server";
import { aggregateCreativePerformance, listCreativeAssets, rankCreativeClustersWithEmbeddings } from "@/lib/creative-dam";
import { getDefaultPipelineStore } from "@/lib/data-pipeline";
import { recordAutomaticDecisionWorkspaceAcceptanceEvidence } from "@/lib/decision-workspace-acceptance";

export async function GET(request: Request) {
  const assets = await listCreativeAssets();
  const pipeline = await getDefaultPipelineStore().read();
  const performance = Object.fromEntries(assets.map((asset) => [asset.creativeId, aggregateCreativePerformance(asset, pipeline.performanceRows)]));
  const inference = await rankCreativeClustersWithEmbeddings(assets, performance);
  const clusters = inference.result.map((cluster) => ({ id: cluster.id, label: cluster.label, assetIds: cluster.assets.map((asset) => asset.id), size: cluster.assets.length, spend: cluster.spend, conversions: cluster.conversions, revenue: cluster.revenue, cpa: cluster.cpa, roas: cluster.roas }));
  const evidence = inference.source === "provider"
    ? await recordAutomaticDecisionWorkspaceAcceptanceEvidence({
        requirementId: "T3.1.5",
        measuredAt: new Date().toISOString(),
        acceptanceMet: true,
        summary: `Provider-backed ${inference.model} clustering produced ${clusters.length} creative clusters from ${assets.length} assets.`,
        runId: `creative-clusters:${Date.now()}`,
        requestOrigin: new URL(request.url).origin,
      })
    : { recorded: false, reason: "provider_not_used" } as const;
  return NextResponse.json({ clusters, source: inference.source, model: inference.model, warning: inference.warning, evidence });
}
