import { NextResponse } from "next/server";
import { z } from "zod";
import { bidRule, learningPhaseProtection, recommendBidStrategy } from "@/lib/budget-automation";

const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("strategy"), cpaHistory: z.array(z.number().nonnegative()), roasHistory: z.array(z.number().nonnegative()), targetCpa: z.number().positive().optional(), targetRoas: z.number().positive().optional() }),
  z.object({ operation: z.literal("rule"), actualCpa: z.number().nonnegative(), targetCpa: z.number().positive(), currentBid: z.number().nonnegative(), learningStatus: z.string().optional() }),
]);
export async function POST(request: Request) {
  try { const body = schema.parse(await request.json()); if (body.operation === "strategy") return NextResponse.json({ result: recommendBidStrategy(body) }); const recommendation = bidRule(body); return NextResponse.json({ result: recommendation, protection: learningPhaseProtection({ learningStatus: body.learningStatus, requestedChangePercent: (recommendation.multiplier - 1) * 100 }) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to evaluate bid strategy." }, { status: 400 }); }
}
