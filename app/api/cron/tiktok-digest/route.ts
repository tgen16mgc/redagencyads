import { NextResponse } from "next/server";
import {
  buildTikTokDailyDigest,
  deliverTikTokDigest,
  recordTikTokDigestDelivery,
} from "@/lib/tiktok-watchlist";
import { validateCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = validateCronRequest(request);
  if (auth === "missing_secret")
    return NextResponse.json(
      { error: "CRON_SECRET is required in production." },
      { status: 503 },
    );
  if (auth === "unauthorized")
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const digest = await buildTikTokDailyDigest({
    region: process.env.TIKTOK_DIGEST_REGION || "VN",
  });
  const delivery = await deliverTikTokDigest({
    digest,
    slackWebhook: process.env.TIKTOK_DIGEST_SLACK_WEBHOOK,
    emailWebhook: process.env.TIKTOK_DIGEST_EMAIL_WEBHOOK,
  });
  if (!delivery.deliveries.length) {
    return NextResponse.json(
      {
        error: "At least one TikTok digest Slack or email webhook is required.",
        digest,
        delivery,
      },
      { status: 503 },
    );
  }
  const delivered = delivery.deliveries.filter((item) => item.ok).length;
  if (!delivered)
    return NextResponse.json(
      {
        error: "TikTok digest delivery failed for every configured channel.",
        digest,
        delivery,
      },
      { status: 502 },
    );
  const acceptance = await recordTikTokDigestDelivery({
    timeZone: digest.deliveryTimezone,
    deliveredChannels: delivery.deliveries
      .filter((item) => item.ok)
      .map((item) => item.channel),
  });
  return NextResponse.json({
    status: delivered === delivery.deliveries.length ? "delivered" : "partial",
    digest,
    delivery,
    acceptance,
  });
}
