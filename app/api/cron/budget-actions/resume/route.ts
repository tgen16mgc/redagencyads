import { NextResponse } from "next/server";
import { processDeferredBudgetActions } from "@/lib/action-audit";
import {
  fetchGoogleAdsCampaignLearningState,
  updateGoogleAdsCampaignBudget,
} from "@/lib/connector-adapters";
import { getGoogleAdsServerWriteContext } from "@/lib/google-ads-auth";
import { graphRequest } from "@/lib/meta-graph";
import { validateCronRequest } from "@/lib/cron-auth";

function googleBudgetId(value: string | undefined) {
  return value?.match(/(?:campaignBudgets\/)?(\d+)$/u)?.[1];
}

export async function GET(request: Request) {
  const auth = validateCronRequest(request);
  if (auth === "missing_secret") return NextResponse.json({ error: "CRON_SECRET is required in production." }, { status: 503 });
  if (auth === "unauthorized") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const metaToken = process.env.META_SYSTEM_ACCESS_TOKEN;
  let googleContext: Awaited<ReturnType<typeof getGoogleAdsServerWriteContext>> | undefined;
  try {
    googleContext = await getGoogleAdsServerWriteContext();
  } catch {
    googleContext = undefined;
  }
  if (!metaToken && !googleContext)
    return NextResponse.json(
      {
        error:
          "META_SYSTEM_ACCESS_TOKEN or scheduled Google Ads write credentials are required to resume deferred budget actions.",
      },
      { status: 503 },
    );

  const result = await processDeferredBudgetActions({
    getLearningStatus: async (action) => {
      if (action.platform === "google_ads") {
        if (!googleContext || !action.campaignId) return undefined;
        const state = await fetchGoogleAdsCampaignLearningState({
          ...googleContext,
          campaignId: action.campaignId,
        });
        if (
          !googleBudgetId(state.campaignBudgetId) ||
          googleBudgetId(state.campaignBudgetId) !==
            googleBudgetId(action.targetId)
        )
          throw new Error(
            "Deferred Google Ads campaign and campaign budget do not match.",
          );
        return state.status;
      }
      if (!metaToken) return undefined;
      const state = await graphRequest<{ effective_status?: string; learning_stage_info?: { status?: string } }>({
        path: `/${action.targetId}`,
        params: { fields: "effective_status,learning_stage_info" },
        token: metaToken,
      });
      return state.learning_stage_info?.status || state.effective_status;
    },
    applyBudget: async (action) => {
      if (action.platform === "google_ads") {
        if (!googleContext)
          throw new Error("Scheduled Google Ads write credentials are unavailable.");
        await updateGoogleAdsCampaignBudget({
          ...googleContext,
          campaignBudgetId: action.targetId,
          amount: action.budget,
        });
        return;
      }
      if (!metaToken)
        throw new Error("META_SYSTEM_ACCESS_TOKEN is unavailable.");
      await graphRequest({ path: `/${action.targetId}`, method: "POST", body: new URLSearchParams({ daily_budget: String(Math.round(action.budget * 100)) }), token: metaToken });
    },
  });
  return NextResponse.json({
    result,
    configuredPlatforms: [
      ...(metaToken ? ["meta"] : []),
      ...(googleContext ? ["google_ads"] : []),
    ],
  });
}
