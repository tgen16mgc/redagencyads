import { NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureActiveWorkspaceMembership, getWorkspaceAuthMode } from "@/lib/workspace-session";

const reportSchema = z.object({
  account: z.object({ id: z.string().min(1), name: z.string().min(1) }).passthrough(),
  dateRange: z.object({ since: z.string().min(1), until: z.string().min(1) }),
  selectedPack: z.string().min(1),
}).passthrough();

const bodySchema = z.object({
  report: reportSchema,
  previousReport: reportSchema.nullable().optional(),
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
    await ensureActiveWorkspaceMembership(supabase, authData.user.id);

    const { data, error } = await supabase
      .from("workspace_report_snapshots")
      .select("id,account_id,account_name,date_since,date_until,selected_pack,report,previous_report,verdict,insights,updated_at")
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
      verdict: body.verdict ? asJson(body.verdict) : null,
      insights: body.insights ? asJson(body.insights) : null,
    }, { onConflict: "user_id,account_id,date_since,date_until,selected_pack" });
    if (error) throw new Error("Report history could not be saved.");
    return NextResponse.json({ saved: true }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Report history could not be saved." }, { status: 400, headers: noStoreHeaders });
  }
}
