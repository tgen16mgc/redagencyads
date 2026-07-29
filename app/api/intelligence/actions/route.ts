import { NextResponse } from "next/server";
import { listActions } from "@/lib/action-audit";

export async function GET() {
  return NextResponse.json({ actions: await listActions() });
}
