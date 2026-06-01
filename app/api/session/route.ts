import { NextResponse } from "next/server";
import { z } from "zod";
import { clearTokenCookie, hasTokenSession, setTokenCookie } from "@/lib/session";
import { validateToken } from "@/lib/meta";

const bodySchema = z.object({
  token: z.string().min(20),
});

export async function GET() {
  return NextResponse.json({ authenticated: await hasTokenSession() });
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const profile = await validateToken(body.token);
    await setTokenCookie(body.token);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Token validation failed." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  await clearTokenCookie();
  return NextResponse.json({ ok: true });
}
