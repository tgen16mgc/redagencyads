import { NextResponse } from "next/server";
import { z } from "zod";
import { deliverPacingAlert } from "@/lib/budget-automation";
import { recordAutomaticDecisionWorkspaceAcceptanceEvidence } from "@/lib/decision-workspace-acceptance";
import { requireToken, sessionErrorStatus } from "@/lib/session";

const schema = z.object({ message: z.string().min(1).max(4000) }).strict();
export async function POST(request: Request) {
  try {
    await requireToken();
    const body = schema.parse(await request.json());
    const deliveries = await deliverPacingAlert({
      message: body.message,
      slackWebhook:
        process.env.BUDGET_ALERT_SLACK_WEBHOOK || process.env.SLACK_WEBHOOK_URL,
      emailWebhook:
        process.env.BUDGET_ALERT_EMAIL_WEBHOOK || process.env.EMAIL_WEBHOOK_URL,
    });
    if (!deliveries.length) {
      return NextResponse.json(
        { error: "At least one configured pacing-alert webhook is required.", deliveries },
        { status: 503 },
      );
    }
    const delivered = deliveries.filter((item) => item.ok).length;
    if (!delivered) {
      return NextResponse.json(
        { error: "Pacing alert delivery failed for every configured channel.", deliveries },
        { status: 502 },
      );
    }
    const evidence = await recordAutomaticDecisionWorkspaceAcceptanceEvidence({
      requirementId: "T4.1.2",
      measuredAt: new Date().toISOString(),
      acceptanceMet: true,
      summary: `Pacing alert delivered through ${delivered}/${deliveries.length} configured channels.`,
      runId: `budget-alert:${Date.now()}`,
      requestOrigin: new URL(request.url).origin,
    });
    return NextResponse.json({ deliveries, evidence });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to deliver pacing alert." },
      { status: sessionErrorStatus(error) },
    );
  }
}
