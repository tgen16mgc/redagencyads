import { NextResponse } from "next/server";
import { z } from "zod";
import { bidMultiplierAt, type DaypartRule } from "@/lib/budget-automation";
import { replaceGoogleAdsCampaignDaypartSchedule } from "@/lib/connector-adapters";
import { getGoogleAdsWriteContext } from "@/lib/google-ads-auth";
import { graphRequest } from "@/lib/meta-graph";
import { requireToken, sessionErrorStatus } from "@/lib/session";
import { recordAction } from "@/lib/action-audit";

const rule = z.object({
  day: z.number().int().min(0).max(6),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  bidMultiplier: z.number().finite().min(0).max(5),
});
const schema = z.object({
  platform: z.enum(["meta", "tiktok", "google_ads"]),
  targetId: z.string().min(1).max(120),
  rules: z.array(rule).min(1).max(168),
  apply: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const rules = body.rules as DaypartRule[];
    if (!body.apply)
      return NextResponse.json({
        rules,
        previewMultiplier: bidMultiplierAt(rules, new Date()),
        audit: await recordAction({
          action: "daypart_schedule",
          target: body.targetId,
          status: "planned",
          details: body,
        }),
      });
    if (body.platform === "tiktok")
      return NextResponse.json(
        {
          error:
            "TikTok daypart writes require an approved owned-account Ads API connector.",
        },
        { status: 501 },
      );
    if (body.platform === "meta") {
      const token = await requireToken();
      const schedule = rules.map((item) => ({
        days: [item.day],
        start_minute: item.startHour * 60,
        end_minute: item.endHour * 60,
        bid_adjustment: item.bidMultiplier,
      }));
      await graphRequest({
        path: `/${body.targetId}`,
        method: "POST",
        body: new URLSearchParams({ adset_schedule: JSON.stringify(schedule) }),
        token,
      });
    } else {
      await replaceGoogleAdsCampaignDaypartSchedule({
        ...(await getGoogleAdsWriteContext(request)),
        campaignId: body.targetId,
        rules,
      });
    }
    return NextResponse.json({
      audit: await recordAction({
        action: "daypart_schedule",
        target: body.targetId,
        status: "applied",
        appliedAt: new Date().toISOString(),
        details: body,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to apply daypart schedule.",
      },
      { status: sessionErrorStatus(error) },
    );
  }
}
