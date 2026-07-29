import { NextResponse } from "next/server";
import { assessPacing, buildPacingPlan, deliverPacingAlert, pacingAlertMessage, type PacingCurve } from "@/lib/budget-automation";
import { validateCronRequest } from "@/lib/cron-auth";
import { getDefaultPipelineStore } from "@/lib/data-pipeline";
import { recordAutomaticDecisionWorkspaceAcceptanceEvidence } from "@/lib/decision-workspace-acceptance";

export const runtime = "nodejs";
export const maxDuration = 300;

function monthWindow(today: Date) {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export async function GET(request: Request) {
  const auth = validateCronRequest(request);
  if (auth === "missing_secret") return NextResponse.json({ error: "CRON_SECRET is required in production." }, { status: 503 });
  if (auth === "unauthorized") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const totalBudget = Number(process.env.BUDGET_ALERT_TOTAL_BUDGET);
  if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
    return NextResponse.json({ status: "skipped", reason: "BUDGET_ALERT_TOTAL_BUDGET is not configured." });
  }

  const today = new Date();
  const todayValue = today.toISOString().slice(0, 10);
  const window = monthWindow(today);
  const snapshot = await getDefaultPipelineStore().read();
  const actualSpend = snapshot.performanceRows
    .filter((row) => row.authority === "owned_performance" && row.date >= window.startDate && row.date <= todayValue)
    .reduce((sum, row) => sum + row.spend, 0);
  const curve = process.env.BUDGET_ALERT_CURVE === "front_loaded" || process.env.BUDGET_ALERT_CURVE === "custom" ? process.env.BUDGET_ALERT_CURVE : "linear";
  const plan = buildPacingPlan({ cadence: "monthly", curve: curve as PacingCurve, totalBudget, ...window });
  const assessment = assessPacing({ plan, actualSpend, asOfDate: todayValue });
  if (!assessment.alert) return NextResponse.json({ status: "on_pace", assessment, actualSpend, totalBudget });

  const message = pacingAlertMessage({ account: process.env.BUDGET_ALERT_ACCOUNT || "owned account", assessment, currency: process.env.BUDGET_ALERT_CURRENCY || "USD" });
  const delivery = await deliverPacingAlert({ message, slackWebhook: process.env.BUDGET_ALERT_SLACK_WEBHOOK || process.env.SLACK_WEBHOOK_URL, emailWebhook: process.env.BUDGET_ALERT_EMAIL_WEBHOOK || process.env.EMAIL_WEBHOOK_URL });
  if (!delivery.length) return NextResponse.json({ status: "delivery_unconfigured", error: "At least one pacing-alert Slack or email webhook is required.", assessment, actualSpend, totalBudget, message, delivery }, { status: 503 });
  const delivered = delivery.filter((item) => item.ok).length;
  if (!delivered) return NextResponse.json({ status: "delivery_failed", error: "Pacing alert delivery failed for every configured channel.", assessment, actualSpend, totalBudget, message, delivery }, { status: 502 });
  const status = delivered === delivery.length ? "alerted" : "partially_alerted";
  const evidence = await recordAutomaticDecisionWorkspaceAcceptanceEvidence({
    requirementId: "T4.1.2",
    measuredAt: new Date().toISOString(),
    acceptanceMet: true,
    summary: `Scheduled pacing alert delivered through ${delivered}/${delivery.length} configured channels.`,
    runId: `budget-alert-cron:${Date.now()}`,
    requestOrigin: new URL(request.url).origin,
  });
  return NextResponse.json({ status, assessment, actualSpend, totalBudget, message, delivery, evidence });
}
