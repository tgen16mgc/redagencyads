import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assessPacing,
  buildPacingPlan,
  learningPhaseProtection,
} from "@/lib/budget-automation";
import { updateGoogleAdsCampaignBudget } from "@/lib/connector-adapters";
import { getGoogleAdsWriteContext } from "@/lib/google-ads-auth";
import { graphRequest } from "@/lib/meta-graph";
import { requireToken, sessionErrorStatus } from "@/lib/session";
import { recordAction } from "@/lib/action-audit";

const schema = z.object({
  cadence: z.enum(["daily", "weekly", "monthly"]),
  curve: z.enum(["linear", "front_loaded", "custom"]),
  totalBudget: z.number().positive(),
  startDate: z.string(),
  endDate: z.string(),
  customWeights: z.array(z.number().nonnegative()).optional(),
  actualSpend: z.number().nonnegative(),
  asOfDate: z.string(),
  apply: z.boolean().default(false),
  platform: z.enum(["meta", "tiktok", "google_ads"]).optional(),
  targetId: z.string().min(1).max(120).optional(),
  campaignId: z.string().min(1).max(160).optional(),
  currentDailyBudget: z.number().positive().optional(),
  learningStatus: z.string().optional(),
});
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const plan = buildPacingPlan(body);
    const assessment = assessPacing({
      plan,
      actualSpend: body.actualSpend,
      asOfDate: body.asOfDate,
    });
    if (!body.apply) return NextResponse.json({ plan, assessment });
    if (!body.platform || !body.targetId || !body.currentDailyBudget)
      throw new Error(
        "platform, targetId, and currentDailyBudget are required to apply pacing.",
      );
    if (body.platform === "tiktok")
      return NextResponse.json(
        {
          error:
            "TikTok pacing writes require an approved owned-account Ads API connector.",
          plan,
          assessment,
        },
        { status: 501 },
      );
    const metaToken =
      body.platform === "meta" ? await requireToken() : undefined;
    const googleContext =
      body.platform === "google_ads"
        ? await getGoogleAdsWriteContext(request)
        : undefined;
    const requestedChangePercent =
      ((assessment.recommendedDailyBudget - body.currentDailyBudget) /
        body.currentDailyBudget) *
      100;
    const protection = learningPhaseProtection({
      learningStatus: body.learningStatus,
      requestedChangePercent,
    });
    if (!protection.allowed) {
      if (
        protection.resumeWhen === "learning_exit" &&
        body.platform === "google_ads" &&
        !body.campaignId
      )
        throw new Error(
          "campaignId is required to auto-resume Google Ads pacing after learning exits.",
        );
      const audit = protection.resumeWhen === "learning_exit"
        ? await recordAction({
            action: "pacing_budget_change",
            target: body.targetId,
            status: "deferred",
            resumeWhen: "learning_exit",
            details: {
              ...body,
              recommendedDailyBudget: assessment.recommendedDailyBudget,
            },
          })
        : undefined;
      return NextResponse.json(
        { plan, assessment, protection, audit },
        { status: audit ? 202 : 409 },
      );
    }
    if (body.platform === "meta") {
      await graphRequest({
        path: `/${body.targetId}`,
        method: "POST",
        body: new URLSearchParams({
          daily_budget: String(
            Math.round(assessment.recommendedDailyBudget * 100),
          ),
        }),
        token: metaToken!,
      });
    } else {
      await updateGoogleAdsCampaignBudget({
        ...googleContext!,
        campaignBudgetId: body.targetId,
        amount: assessment.recommendedDailyBudget,
      });
    }
    return NextResponse.json({
      plan,
      assessment,
      protection,
      audit: await recordAction({
        action: "pacing_budget_change",
        target: body.targetId,
        status: "applied",
        appliedAt: new Date().toISOString(),
        details: {
          ...body,
          recommendedDailyBudget: assessment.recommendedDailyBudget,
        },
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to assess pacing.",
      },
      { status: sessionErrorStatus(error) },
    );
  }
}
