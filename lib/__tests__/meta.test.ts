import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InsightRow, MetaAccount, MetaAdSet, MetaCampaign } from "../types";

const { graphList, graphRequest } = vi.hoisted(() => ({
  graphList: vi.fn(),
  graphRequest: vi.fn(),
}));

vi.mock("@/lib/meta-graph", () => ({ graphList, graphRequest }));

import { buildReport } from "../meta";

type GraphArgs = { path: string; params?: Record<string, string | number | undefined>; token?: string };

type Fixture = {
  accounts?: MetaAccount[];
  campaigns?: MetaCampaign[];
  campaignInsights?: InsightRow[];
  adsets?: MetaAdSet[];
  ads?: Array<{ id: string; name: string; adset_id: string; status: string; effective_status: string }>;
};

const account: MetaAccount = { id: "act_123", account_id: "123", name: "Main account", currency: "VND" };
const activeCampaign: MetaCampaign = { id: "c1", name: "Leads always-on", effective_status: "ACTIVE" };

function campaignInsightRow(overrides: Partial<InsightRow> = {}): InsightRow {
  return {
    campaign_id: "c1",
    campaign_name: "Leads always-on",
    impressions: "1000",
    clicks: "50",
    spend: "200",
    date_start: "2026-07-01",
    date_stop: "2026-07-07",
    ...overrides,
  };
}

function stubGraph(fixture: Fixture) {
  graphList.mockImplementation(async (args: GraphArgs) => {
    if (args.path === "/me/adaccounts") return fixture.accounts ?? [account];
    if (args.path.endsWith("/campaigns")) return fixture.campaigns ?? [activeCampaign];
    if (args.path.endsWith("/insights")) {
      const params = args.params || {};
      if (params.level === "campaign" && !params.breakdowns && !params.time_increment) {
        return fixture.campaignInsights ?? [campaignInsightRow()];
      }
      return [];
    }
    if (args.path.endsWith("/adsets")) return fixture.adsets ?? [];
    if (args.path.endsWith("/ads")) return fixture.ads ?? [];
    throw new Error(`Unexpected graphList path: ${args.path}`);
  });
  graphRequest.mockImplementation(async (args: GraphArgs) => {
    if (args.path.endsWith("/previews")) {
      return { data: [{ body: `<iframe src="${args.path}"></iframe>` }] };
    }
    throw new Error(`Unexpected graphRequest path: ${args.path}`);
  });
}

const reportArgs = {
  token: "user-token",
  accountId: "123",
  campaignIds: [],
  since: "2026-07-01",
  until: "2026-07-07",
};

describe("buildReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes the account id and resolves the account by account_id fallback", async () => {
    stubGraph({ accounts: [{ id: "unexpected_shape", account_id: "123", name: "Main account" }] });

    const report = await buildReport(reportArgs);

    expect(report.account).toMatchObject({ account_id: "123", name: "Main account" });
    const campaignCall = graphList.mock.calls.find(([args]) => String(args.path).endsWith("/campaigns"))?.[0];
    expect(campaignCall).toMatchObject({ path: "/act_123/campaigns", token: "user-token" });
  });

  it("rejects when the account is not visible to the current token", async () => {
    stubGraph({ accounts: [{ id: "act_999", account_id: "999", name: "Other account" }] });

    await expect(buildReport(reportArgs)).rejects.toThrow("Selected account not found for current token.");
  });

  it("defaults to ACTIVE campaigns when none are selected", async () => {
    stubGraph({
      campaigns: [
        activeCampaign,
        { id: "c2", name: "Paused test", effective_status: "PAUSED" },
      ],
    });

    const report = await buildReport(reportArgs);

    expect(report.selectedCampaigns.map((campaign) => campaign.id)).toEqual(["c1"]);
    const insightCalls = graphList.mock.calls.filter(([args]) => String(args.path).endsWith("/insights"));
    for (const [args] of insightCalls) {
      expect(args.params.filtering).toBe(JSON.stringify([{ field: "campaign.id", operator: "IN", value: ["c1"] }]));
    }
  });

  it("keeps explicitly selected campaigns regardless of status", async () => {
    stubGraph({
      campaigns: [
        activeCampaign,
        { id: "c2", name: "Paused test", effective_status: "PAUSED" },
      ],
      campaignInsights: [campaignInsightRow({ campaign_id: "c2", campaign_name: "Paused test" })],
    });

    const report = await buildReport({ ...reportArgs, campaignIds: ["c2"] });

    expect(report.selectedCampaigns.map((campaign) => campaign.id)).toEqual(["c2"]);
  });

  it("rejects when no campaign is selected or active", async () => {
    stubGraph({ campaigns: [{ id: "c2", name: "Paused test", effective_status: "PAUSED" }] });

    await expect(buildReport(reportArgs)).rejects.toThrow("No campaign selected or active campaigns found.");
  });

  it("fans out insights requests across levels, daily increments, and breakdowns", async () => {
    stubGraph({});

    await buildReport(reportArgs);

    const insightParams = graphList.mock.calls
      .filter(([args]) => String(args.path).endsWith("/insights"))
      .map(([args]) => args.params);
    expect(insightParams).toHaveLength(7);
    for (const params of insightParams) {
      expect(params.time_range).toBe(JSON.stringify({ since: "2026-07-01", until: "2026-07-07" }));
      expect(params.limit).toBe(200);
      expect(String(params.fields)).toContain("spend");
    }
    const baseCampaign = insightParams.filter(
      (params) => params.level === "campaign" && !params.breakdowns && !params.time_increment,
    );
    expect(baseCampaign).toHaveLength(1);
    expect(insightParams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "adset" }),
        expect.objectContaining({ level: "ad" }),
        expect.objectContaining({ level: "campaign", time_increment: 1 }),
        expect.objectContaining({ level: "campaign", breakdowns: "publisher_platform" }),
        expect.objectContaining({ level: "campaign", breakdowns: "age,gender" }),
        expect.objectContaining({ level: "campaign", breakdowns: "region" }),
      ]),
    );
  });

  it("requests previews only for active ads inside active ad sets", async () => {
    stubGraph({
      adsets: [
        { id: "as1", name: "Active set", campaign_id: "c1", effective_status: "ACTIVE" },
        { id: "as2", name: "Paused set", campaign_id: "c1", effective_status: "PAUSED" },
      ],
      ads: [
        { id: "ad1", name: "Live ad", adset_id: "as1", status: "ACTIVE", effective_status: "ACTIVE" },
        { id: "ad2", name: "Orphaned ad", adset_id: "as2", status: "ACTIVE", effective_status: "ACTIVE" },
        { id: "ad3", name: "Paused ad", adset_id: "as1", status: "PAUSED", effective_status: "PAUSED" },
      ],
    });

    const report = await buildReport(reportArgs);

    const previewCalls = graphRequest.mock.calls.filter(([args]) => String(args.path).endsWith("/previews"));
    expect(previewCalls.map(([args]) => args.path)).toEqual(["/ad1/previews"]);
    expect(report.adsetPreviews).toEqual([
      expect.objectContaining({
        id: "as1",
        campaignName: "Leads always-on",
        ads: [expect.objectContaining({ id: "ad1", previewHtml: '<iframe src="/ad1/previews"></iframe>' })],
      }),
    ]);
  });

  it("uses the detected KPI pack when no override is provided", async () => {
    stubGraph({
      campaigns: [{ id: "c1", name: "Inbox chat blast", effective_status: "ACTIVE" }],
      campaignInsights: [
        campaignInsightRow({
          campaign_name: "Inbox chat blast",
          actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "12" }],
        }),
      ],
    });

    const report = await buildReport(reportArgs);

    expect(report.detectedPack).toBe("messages");
    expect(report.selectedPack).toBe("messages");
    expect(report.kpis.some((kpi) => kpi.key === "messages")).toBe(true);
  });

  it("keeps the detected pack visible when a Selected KPI Pack override is applied", async () => {
    stubGraph({
      campaigns: [{ id: "c1", name: "Inbox chat blast", effective_status: "ACTIVE" }],
      campaignInsights: [
        campaignInsightRow({
          campaign_name: "Inbox chat blast",
          actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "12" }],
        }),
      ],
    });

    const report = await buildReport({ ...reportArgs, pack: "sales_roas" });

    expect(report.detectedPack).toBe("messages");
    expect(report.selectedPack).toBe("sales_roas");
    expect(report.kpis.some((kpi) => kpi.key === "roas")).toBe(true);
  });
});
