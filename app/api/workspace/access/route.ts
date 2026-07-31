import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

const bodySchema = z.object({ email: z.string().email() });

async function notifyWorkspaceAdmin(email: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const to = process.env.ACCESS_REQUEST_NOTIFICATION_EMAIL?.trim();
  if (!apiKey || !from || !to) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Decision Workspace access request: ${email}`,
      text: `${email} requested access to Decision Workspace. Review the pending request in Supabase table workspace_access_requests.`,
    }),
  });

  if (!response.ok) console.error("Access-request email delivery failed with status", response.status);
}

export async function POST(request: Request) {
  try {
    const config = getSupabaseConfig();
    if (!config.configured) {
      return NextResponse.json({ ok: false, error: "Access requests are not configured on this deployment." }, { status: 503 });
    }

    const { email } = bodySchema.parse(await request.json());
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createClient<Database>(config.url, config.publishableKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const { error } = await supabase.rpc("request_workspace_access", { p_email: normalizedEmail });
    if (error) throw new Error("Could not save the access request. Try again shortly.");

    await notifyWorkspaceAdmin(normalizedEmail);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not request workspace access." },
      { status: 400 },
    );
  }
}
