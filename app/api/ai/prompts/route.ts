import { NextResponse } from "next/server";
import { z } from "zod";
import { activePrompt, AI_CHARTER } from "@/lib/prompt-library";
import { getDefaultPromptStore, savePromptVersion } from "@/lib/prompt-store";

const useCase = z.enum(["copy_generation", "creative_brief", "performance_narration", "anomaly_detection", "forecasting"]);
const schema = z.object({ id: z.string().min(1), useCase, template: z.string().min(1).max(20_000), variables: z.array(z.string()).max(100), changelog: z.string().max(1000), active: z.boolean().optional() });

export async function GET() { const { library } = await getDefaultPromptStore().read(); return NextResponse.json({ charter: AI_CHARTER, library, active: Object.fromEntries(AI_CHARTER.map((item) => [item.useCase, activePrompt(library, item.useCase) || null])) }); }
export async function POST(request: Request) {
  try { const library = await savePromptVersion(getDefaultPromptStore(), schema.parse(await request.json())); return NextResponse.json({ library }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add prompt version." }, { status: 400 }); }
}
