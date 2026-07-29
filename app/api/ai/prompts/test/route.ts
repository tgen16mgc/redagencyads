import { NextResponse } from "next/server";
import { z } from "zod";
import { assignStoredPromptTest, createStoredPromptTest, getDefaultPromptStore, listStoredPromptTests, recordStoredPromptTestResult } from "@/lib/prompt-store";

const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), id: z.string().min(1), useCase: z.enum(["copy_generation", "creative_brief", "performance_narration", "anomaly_detection", "forecasting"]), controlPromptId: z.string().min(1), treatmentPromptId: z.string().min(1), metric: z.enum(["acceptance_rate", "edit_distance", "task_success"]) }),
  z.object({ operation: z.literal("assign"), id: z.string().min(1), unitId: z.string().min(1) }),
  z.object({ operation: z.literal("result"), id: z.string().min(1), unitId: z.string().min(1), value: z.number().finite().nonnegative() }),
]);
export async function GET() { return NextResponse.json({ tests: await listStoredPromptTests(getDefaultPromptStore()) }); }
export async function POST(request: Request) {
  try { const body = schema.parse(await request.json()); const store = getDefaultPromptStore(); const result = body.operation === "create" ? await createStoredPromptTest(store, body) : body.operation === "assign" ? await assignStoredPromptTest(store, body.id, body.unitId) : await recordStoredPromptTestResult(store, body.id, body.unitId, body.value); return NextResponse.json({ result }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run prompt test." }, { status: 400 }); }
}
