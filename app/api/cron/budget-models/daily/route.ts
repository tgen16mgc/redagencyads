import { NextResponse } from "next/server";
import { refreshDailyBudgetModels } from "@/lib/budget-models";
import { validateCronRequest } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const auth = validateCronRequest(request);
  if (auth === "missing_secret") return NextResponse.json({ error: "CRON_SECRET is required in production." }, { status: 503 });
  if (auth === "unauthorized") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ snapshot: await refreshDailyBudgetModels() });
}
