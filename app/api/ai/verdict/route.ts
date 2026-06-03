import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVerdict } from "@/lib/ai";
import type { DashboardReport } from "@/lib/types";

const providerSchema = z.enum(["auto", "openai", "openrouter", "prompt"]).default("auto");
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

const structuredBodySchema = z.object({
  report: z.custom<DashboardReport>(isDashboardReport, "report is required."),
  language: languageSchema,
  provider: providerSchema,
});

const legacyBodySchema = z.object({
  prompt: z.string().min(100),
  language: languageSchema,
  provider: providerSchema,
});

const bodySchema = z.union([structuredBodySchema, legacyBodySchema]);

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const verdict = await generateVerdict(body);
    return NextResponse.json({ verdict });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate verdict." },
      { status: 400 },
    );
  }
}
