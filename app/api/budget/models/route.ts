import { NextResponse } from "next/server";
import { JsonBudgetModelStore } from "@/lib/budget-models";

export async function GET() {
  return NextResponse.json({ snapshot: await new JsonBudgetModelStore().read() });
}
