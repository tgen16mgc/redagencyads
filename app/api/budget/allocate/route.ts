import { NextResponse } from "next/server";
import { z } from "zod";
import { scenarioWithPlatformShocks } from "@/lib/budget-allocator";

const curveSchema = z.object({
  id: z.string().min(1).max(120),
  platform: z.string().min(1).max(80),
  currentSpend: z.number().finite().nonnegative(),
  currentRevenue: z.number().finite().nonnegative(),
  minSpend: z.number().finite().nonnegative(),
  maxSpend: z.number().finite().nonnegative(),
  minRoas: z.number().finite().nonnegative().optional(),
  curve: z.array(z.object({ spend: z.number().finite().nonnegative(), revenue: z.number().finite().nonnegative() })).min(2).max(100),
});

const shockSchema = z.object({ platform: z.string().min(1).max(80), multiplier: z.number().finite().positive().max(10) });

export async function POST(request: Request) {
  try {
    const body = await request.json() as { totalBudget?: unknown; step?: unknown; curves?: unknown; cpmShocks?: unknown };
    const totalBudget = z.number().finite().nonnegative().parse(body.totalBudget);
    const step = body.step === undefined ? undefined : z.number().finite().positive().parse(body.step);
    const curves = z.array(curveSchema).min(1).max(100).parse(body.curves);
    const shocks = body.cpmShocks === undefined ? [] : z.array(shockSchema).max(20).parse(body.cpmShocks);
    return NextResponse.json({ result: scenarioWithPlatformShocks({ totalBudget, step, curves, shocks }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to allocate budget." }, { status: 400 });
  }
}
