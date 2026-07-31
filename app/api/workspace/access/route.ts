import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const { email } = bodySchema.parse(await request.json());
    const endpoint = process.env.WORKSPACE_ACCESS_WEBHOOK_URL?.trim();
    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "Access-request delivery is not configured. Contact your workspace administrator directly." }, { status: 503 });
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "workspace_access_request", email: email.trim().toLowerCase(), requestedAt: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error(`Access-request provider returned ${response.status}.`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not request workspace access." }, { status: 400 });
  }
}
