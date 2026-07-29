import { NextResponse } from "next/server";
import { getDefaultPipelineStore, pipelineHealth } from "@/lib/data-pipeline";

export async function GET() {
  return NextResponse.json({ health: pipelineHealth(await getDefaultPipelineStore().read()), checkedAt: new Date().toISOString() });
}
