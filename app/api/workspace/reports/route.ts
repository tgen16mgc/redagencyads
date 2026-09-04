import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { buildReportRequestKey, type ReportExecutionScope } from "@/lib/report-refresh";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureActiveWorkspaceMembership, getWorkspaceAuthMode } from "@/lib/workspace-session";

const reportSchema = z.object({
  account: z.object({ id: z.string().min(1), name: z.string().min(1) }).passthrough(),
  dateRange: z.object({ since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) }),
  selectedPack: z.string().min(1),
  selectedCampaigns: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional(),
}).passthrough();

const dateInputSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const optionalPositiveNumberSchema = z.string().refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) > 0));

const bodySchema = z.object({
  report: reportSchema,
  previousReport: reportSchema.nullable().optional(),
  executionScope: z.object({
    accountId: z.string().min(1),
    selectedCampaignIds: z.array(z.string().min(1)),
    since: dateInputSchema,
    until: dateInputSchema,
    pack: z.enum(["auto", "lead_gen", "messages", "sales_roas", "traffic", "awareness"]),
    compareMode: z.enum(["off", "previous", "campaign", "wow", "mom", "yoy"]),
    comparisonCampaignIds: z.array(z.string().min(1)),
    comparisonSince: z.string(),
    comparisonUntil: z.string(),
    targetCpa: optionalPositiveNumberSchema,
    targetRoas: optionalPositiveNumberSchema,
  }).superRefine((scope, context) => {
    if (scope.since > scope.until) context.addIssue({ code: "custom", message: "The report date range is invalid." });
    if (scope.compareMode === "off") {
      if (scope.comparisonCampaignIds.length || scope.comparisonSince || scope.comparisonUntil) context.addIssue({ code: "custom", message: "Comparison scope must be empty when comparison is off." });
      return;
    }
    if (!dateInputSchema.safeParse(scope.comparisonSince).success
      || !dateInputSchema.safeParse(scope.comparisonUntil).success
      || scope.comparisonSince > scope.comparisonUntil) {
      context.addIssue({ code: "custom", message: "The comparison date range is invalid." });
    }
  }),
  verdict: z.record(z.unknown()).nullable().optional(),
  insights: z.record(z.unknown()).nullable().optional(),
});

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function GET() {
  try {
    if (getWorkspaceAuthMode() !== "supabase") return NextResponse.json({ reports: [] }, { headers: noStoreHeaders });
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in again to load report history.");
    const membership = await ensureActiveWorkspaceMembership(supabase, authData.user.id);
    if (!membership) throw new Error("Workspace membership could not be verified.");

    const { data, error } = await supabase
      .from("workspace_report_snapshots")
      .select("id,account_id,account_name,date_since,date_until,selected_pack,report,previous_report,execution_scope,scope_key,verdict,insights,updated_at")
      .eq("workspace_id", membership.workspace_id)
      .eq("user_id", authData.user.id)
      .order("updated_at", { ascending: false })
      .limit(12);
    if (error) throw new Error("Report history could not be loaded.");

    return NextResponse.json({
      reports: (data || []).map((item) => ({
        id: item.id,
        accountId: item.account_id,
        accountName: item.account_name,
        dateSince: item.date_since,
        dateUntil: item.date_until,
        selectedPack: item.selected_pack,
        report: item.report,
        previousReport: item.previous_report,
        executionScope: item.execution_scope,
        scopeKey: item.scope_key,
        verdict: item.verdict,
        insights: item.insights,
        updatedAt: item.updated_at,
      })),
    }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Report history could not be loaded." }, { status: 400, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  try {
    if (getWorkspaceAuthMode() !== "supabase") return NextResponse.json({ saved: false }, { headers: noStoreHeaders });
    const raw = await request.text();
    if (raw.length > 4_000_000) throw new Error("The report is too large to save to workspace history.");
    const body = bodySchema.parse(JSON.parse(raw));
    assertScopeMatchesReport(body.executionScope, body.report, body.previousReport || null);
    const scopeKey = createHash("sha256")
      .update(buildReportRequestKey(body.executionScope as ReportExecutionScope))
      .digest("hex");
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in again to save report history.");
    const membership = await ensureActiveWorkspaceMembership(supabase, authData.user.id);
    if (!membership) throw new Error("Workspace membership could not be verified.");

    const { error } = await supabase.from("workspace_report_snapshots").upsert({
      workspace_id: membership.workspace_id,
      user_id: authData.user.id,
      account_id: body.report.account.id,
      account_name: body.report.account.name,
      date_since: body.report.dateRange.since,
      date_until: body.report.dateRange.until,
      selected_pack: body.report.selectedPack,
      report: asJson(body.report),
      previous_report: body.previousReport ? asJson(body.previousReport) : null,
      execution_scope: asJson(body.executionScope),
      scope_key: scopeKey,
      verdict: body.verdict ? asJson(body.verdict) : null,
      insights: body.insights ? asJson(body.insights) : null,
    }, { onConflict: "workspace_id,user_id,scope_key" });
    if (error) throw new Error("Report history could not be saved.");
    return NextResponse.json({ saved: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Report history could not be saved." }, { status: 400, headers: noStoreHeaders });
  }
}

function assertScopeMatchesReport(
  scope: ReportExecutionScope,
  report: z.infer<typeof reportSchema>,
  previousReport: z.infer<typeof reportSchema> | null,
) {
  if (scope.accountId !== report.account.id
    || scope.since !== report.dateRange.since
    || scope.until !== report.dateRange.until
    || scope.pack !== report.selectedPack) {
    throw new Error("The saved execution scope does not match the report.");
  }
  assertCampaignIdsMatch(scope.selectedCampaignIds, report.selectedCampaigns);
  if (scope.compareMode !== "off" && previousReport
    && (scope.comparisonSince !== previousReport.dateRange.since
    || scope.comparisonUntil !== previousReport.dateRange.until)) {
    throw new Error("The saved comparison scope does not match the comparison report.");
  }
  if (previousReport) assertCampaignIdsMatch(scope.comparisonCampaignIds, previousReport.selectedCampaigns);
}

function assertCampaignIdsMatch(scopeIds: string[], campaigns?: Array<{ id: string }>) {
  if (!campaigns?.length) return;
  const reportIds = [...new Set(campaigns.map((campaign) => campaign.id))].sort();
  const expectedIds = [...new Set(scopeIds)].sort();
  if (reportIds.length !== expectedIds.length || reportIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error("The saved campaign scope does not match the report.");
  }
}

export async function DELETE() {
  try {
    if (getWorkspaceAuthMode() !== "supabase") return NextResponse.json({ cleared: false }, { headers: noStoreHeaders });
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in again to clear report history.");
    const membership = await ensureActiveWorkspaceMembership(supabase, authData.user.id);
    if (!membership) throw new Error("Workspace membership could not be verified.");

    const { error } = await supabase
      .from("workspace_report_snapshots")
      .delete()
      .eq("workspace_id", membership.workspace_id)
      .eq("user_id", authData.user.id);
    if (error) throw new Error("Report history could not be cleared.");

    return NextResponse.json({ cleared: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Report history could not be cleared." }, { status: 400, headers: noStoreHeaders });
  }
}
