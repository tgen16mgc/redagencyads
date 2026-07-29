import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAction } from "@/lib/action-audit";
import {
  enforcePlatformCaps,
  learningPhaseProtection,
} from "@/lib/budget-automation";
import {
  pauseGoogleAdsCampaign,
  updateGoogleAdsCampaignBudget,
} from "@/lib/connector-adapters";
import { getGoogleAdsWriteContext } from "@/lib/google-ads-auth";
import { graphRequest } from "@/lib/meta-graph";
import { requireToken, sessionErrorStatus } from "@/lib/session";

const campaignSchema = z.object({
  id: z.string().min(1).max(120),
  platform: z.enum(["meta", "tiktok", "google_ads"]),
  spend: z.number().finite().nonnegative(),
  cap: z.number().finite().nonnegative(),
  roas: z.number().finite().nonnegative(),
  active: z.boolean(),
  dailyBudget: z.number().finite().positive().optional(),
  budgetId: z.string().min(1).max(160).optional(),
  learningStatus: z.string().optional(),
});

const schema = z.object({
  campaigns: z.array(campaignSchema).min(1).max(500),
  apply: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const plan = enforcePlatformCaps(body.campaigns);
    const stopped = body.campaigns.filter((campaign) =>
      plan.stopped.includes(campaign.id),
    );
    const nextBest = body.campaigns.find(
      (campaign) => campaign.id === plan.nextBestCampaignId,
    );
    const details = { campaigns: body.campaigns, plan };
    if (!body.apply) {
      return NextResponse.json({
        plan,
        audit: await recordAction({
          action: "platform_cap_enforcement",
          target: plan.stopped.join(",") || "none",
          status: "planned",
          details,
        }),
      });
    }
    const affected = [
      ...stopped,
      ...(nextBest && plan.redistribute > 0 ? [nextBest] : []),
    ];
    const affectedPlatforms = new Set(
      affected.map((campaign) => campaign.platform),
    );
    if (affectedPlatforms.has("tiktok") || affectedPlatforms.size > 1) {
      return NextResponse.json(
        {
          error:
            "Cap writes require every affected campaign to use the same connected Meta or Google Ads account.",
          plan,
        },
        { status: 501 },
      );
    }
    if (nextBest && plan.redistribute > 0 && !nextBest.dailyBudget) {
      return NextResponse.json(
        {
          error:
            "The next-best campaign needs its current daily budget before redistribution can be applied.",
          plan,
        },
        { status: 400 },
      );
    }
    if (
      nextBest?.platform === "google_ads" &&
      plan.redistribute > 0 &&
      !nextBest.budgetId
    )
      return NextResponse.json(
        {
          error:
            "The next-best Google campaign needs its campaign budget ID before redistribution can be applied.",
          plan,
        },
        { status: 400 },
      );
    if (nextBest && plan.redistribute > 0) {
      const requestedChangePercent =
        (plan.redistribute / nextBest.dailyBudget!) * 100;
      const protection = learningPhaseProtection({
        learningStatus: nextBest.learningStatus,
        requestedChangePercent,
      });
      if (!protection.allowed)
        return NextResponse.json(
          { error: protection.reason, plan, protection },
          { status: 409 },
        );
    }
    if (affectedPlatforms.has("google_ads")) {
      const context = await getGoogleAdsWriteContext(request);
      for (const campaign of stopped)
        await pauseGoogleAdsCampaign({ ...context, campaignId: campaign.id });
      if (nextBest && plan.redistribute > 0)
        await updateGoogleAdsCampaignBudget({
          ...context,
          campaignBudgetId: nextBest.budgetId!,
          amount: nextBest.dailyBudget! + plan.redistribute,
        });
    } else {
      const token = await requireToken();
      for (const campaign of stopped)
        await graphRequest({
          path: `/${campaign.id}`,
          method: "POST",
          body: new URLSearchParams({ status: "PAUSED" }),
          token,
        });
      if (nextBest && plan.redistribute > 0)
        await graphRequest({
          path: `/${nextBest.id}`,
          method: "POST",
          body: new URLSearchParams({
            daily_budget: String(
              Math.round((nextBest.dailyBudget! + plan.redistribute) * 100),
            ),
          }),
          token,
        });
    }
    return NextResponse.json({
      plan,
      audit: await recordAction({
        action: "platform_cap_enforcement",
        target: plan.stopped.join(",") || "none",
        status: "applied",
        appliedAt: new Date().toISOString(),
        details,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to enforce platform caps.",
      },
      { status: sessionErrorStatus(error) },
    );
  }
}
