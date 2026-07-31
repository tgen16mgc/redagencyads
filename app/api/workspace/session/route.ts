import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearWorkspaceSession,
  getWorkspaceAuthConfig,
  setWorkspaceSession,
  authenticateWorkspace,
  workspaceSessionStatus,
} from "@/lib/workspace-session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  keepSignedIn: z.boolean().default(true),
});

export async function GET() {
  return NextResponse.json(await workspaceSessionStatus());
}

export async function POST(request: Request) {
  try {
    const config = getWorkspaceAuthConfig();
    if (config.mode === "disabled") {
      return NextResponse.json({ ok: false, error: "Workspace sign-in is disabled on this deployment." }, { status: 409 });
    }
    if (config.mode === "unconfigured" || !config.configured) {
      return NextResponse.json({ ok: false, error: "Workspace authentication is not fully configured." }, { status: 503 });
    }
    const body = bodySchema.parse(await request.json());
    await authenticateWorkspace(body.email, body.password);
    await setWorkspaceSession(body.keepSignedIn);
    return NextResponse.json(await workspaceSessionStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign in to the workspace.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("does not match") ? 401 : 400 },
    );
  }
}

export async function DELETE() {
  await clearWorkspaceSession();
  return NextResponse.json(await workspaceSessionStatus());
}
