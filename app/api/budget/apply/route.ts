import { NextResponse } from "next/server";
import { z } from "zod";
import { updateGoogleAdsCampaignBudget } from "@/lib/connector-adapters";
import { getGoogleAdsWriteContext } from "@/lib/google-ads-auth";
import { graphRequest } from "@/lib/meta-graph";
import { requireToken, sessionErrorStatus } from "@/lib/session";
import { learningPhaseProtection } from "@/lib/budget-automation";
import { recordAction } from "@/lib/action-audit";

const schema = z.object({
  platform: z.enum(["meta", "tiktok", "google_ads"]),
  targetId: z.string().min(1),
  campaignId: z.string().min(1).max(160).optional(),
  budget: z.number().positive(),
  currentBudget: z.number().positive(),
  learningStatus: z.string().optional(),
  apply: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    let metaToken: string | undefined;
    let googleContext:
      | Awaited<ReturnType<typeof getGoogleAdsWriteContext>>
      | undefined;
    if (body.apply) {
      if (body.platform === "tiktok") {
        return NextResponse.json(
          {
            error:
              "TikTok budget writes require an approved owned-account Ads API connector.",
          },
          { status: 501 },
        );
      }
      if (body.platform === "meta") metaToken = await requireToken();
      else googleContext = await getGoogleAdsWriteContext(request);
    }
    const change =
      ((body.budget - body.currentBudget) / body.currentBudget) * 100;
    const protection = learningPhaseProtection({
      learningStatus: body.learningStatus,
      requestedChangePercent: change,
    });
    if (!protection.allowed) {
      if (
        protection.resumeWhen === "learning_exit" &&
        body.platform === "google_ads" &&
        !body.campaignId
      )
        throw new Error(
          "campaignId is required to auto-resume a Google Ads budget after learning exits.",
        );
      const audit = protection.resumeWhen === "learning_exit"
        ? await recordAction({
            action: "budget_change",
            target: body.targetId,
            status: "deferred",
            resumeWhen: "learning_exit",
            details: body,
          })
        : undefined;
      return NextResponse.json(
        { error: protection.reason, protection, audit },
        { status: audit ? 202 : 409 },
      );
    }
    if (!body.apply)
      return NextResponse.json({
        audit: await recordAction({
          action: "budget_change",
          target: body.targetId,
          status: "planned",
          details: body,
        }),
        protection,
      });
    if (body.platform === "meta") {
      await graphRequest({
        path: `/${body.targetId}`,
        method: "POST",
        body: new URLSearchParams({
          daily_budget: String(Math.round(body.budget * 100)),
        }),
        token: metaToken!,
      });
    } else if (body.platform === "google_ads") {
      await updateGoogleAdsCampaignBudget({
        ...googleContext!,
        campaignBudgetId: body.targetId,
        amount: body.budget,
      });
    }
    return NextResponse.json({
      audit: await recordAction({
        action: "budget_change",
        target: body.targetId,
        status: "applied",
        appliedAt: new Date().toISOString(),
        details: body,
      }),
      protection,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to apply budget.",
      },
      { status: sessionErrorStatus(error) },
    );
  }
}
