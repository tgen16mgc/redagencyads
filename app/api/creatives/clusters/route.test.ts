import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listCreativeAssets,
  aggregateCreativePerformance,
  rankCreativeClustersWithEmbeddings,
  pipelineRead,
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
} = vi.hoisted(() => ({
  listCreativeAssets: vi.fn(),
  aggregateCreativePerformance: vi.fn(),
  rankCreativeClustersWithEmbeddings: vi.fn(),
  pipelineRead: vi.fn(),
  recordAutomaticDecisionWorkspaceAcceptanceEvidence: vi.fn(),
}));

vi.mock("@/lib/creative-dam", () => ({
  listCreativeAssets,
  aggregateCreativePerformance,
  rankCreativeClustersWithEmbeddings,
}));
vi.mock("@/lib/data-pipeline", () => ({
  getDefaultPipelineStore: () => ({ read: pipelineRead }),
}));
vi.mock("@/lib/decision-workspace-acceptance", () => ({
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
}));

import { GET } from "./route";

describe("GET /api/creatives/clusters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const asset = { id: "asset-1", creativeId: "creative-1" };
    listCreativeAssets.mockResolvedValue([asset]);
    pipelineRead.mockResolvedValue({
      performanceRows: [],
      creativeRows: [],
      jobs: [],
    });
    aggregateCreativePerformance.mockReturnValue({
      spend: 100,
      conversions: 10,
      revenue: 300,
    });
    rankCreativeClustersWithEmbeddings.mockResolvedValue({
      source: "provider",
      model: "clip",
      result: [
        {
          id: "cluster-1",
          label: "UGC",
          assets: [asset],
          spend: 100,
          conversions: 10,
          revenue: 300,
          cpa: 10,
          roas: 3,
        },
      ],
    });
    recordAutomaticDecisionWorkspaceAcceptanceEvidence.mockResolvedValue({
      recorded: true,
      reason: "recorded",
    });
  });

  it("records production evidence only for provider-backed clustering", async () => {
    const response = await GET(
      new Request("https://workspace.example.test/api/creatives/clusters"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: "provider",
      clusters: [{ id: "cluster-1", size: 1, roas: 3 }],
    });
    expect(recordAutomaticDecisionWorkspaceAcceptanceEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        requirementId: "T3.1.5",
        acceptanceMet: true,
        requestOrigin: "https://workspace.example.test",
      }),
    );
  });

  it("does not certify heuristic clustering", async () => {
    rankCreativeClustersWithEmbeddings.mockResolvedValueOnce({
      source: "heuristic",
      model: "clip",
      warning: "Configure a provider.",
      result: [],
    });

    const response = await GET(
      new Request("http://localhost/api/creatives/clusters"),
    );

    expect(await response.json()).toMatchObject({
      source: "heuristic",
      evidence: { recorded: false, reason: "provider_not_used" },
    });
    expect(recordAutomaticDecisionWorkspaceAcceptanceEvidence).not.toHaveBeenCalled();
  });
});
