import { NextResponse } from "next/server";
import { runConfiguredConnectorSync } from "@/lib/sync-runner";
import { validateCronRequest } from "@/lib/cron-auth";

export const maxDuration = 300;
export async function GET(request: Request) {
  const auth = validateCronRequest(request);
  if (auth === "missing_secret") return NextResponse.json({ error: "CRON_SECRET is required in production." }, { status: 503 });
  if (auth === "unauthorized") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(await runConfiguredConnectorSync({ mode: "full" }));
}
