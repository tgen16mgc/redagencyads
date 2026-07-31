import { NextResponse } from "next/server";
import { z } from "zod";
import { generateInsights } from "@/lib/ai/insights";
import type { DashboardReport } from "@/lib/types";

const providerSchema = z.enum(["auto", "9router", "prompt"]).default("auto");
const languageSchema = z.enum(["en", "vi"]).default("en");

function isDashboardReport(value: unknown): value is DashboardReport {
  return Boolean(
    value &&
      typeof value === "object" &&
      "account" in value &&
      "selectedPack" in value &&
      "totals" in value &&
      "health" in value,
  );
}

const bodySchema = z.object({
  report: z.custom<DashboardReport>(isDashboardReport, "report is required."),
  previousReport: z.custom<DashboardReport>(isDashboardReport).nullable().optional(),
  compareMode: z.enum(["off", "previous", "campaign", "wow", "mom", "yoy"]).default("off"),
  language: languageSchema,
  provider: providerSchema,
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const insights = await generateInsights(body);
    return NextResponse.json({ insights });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate insights." },
      { status: 400 },
    );
  }
}
