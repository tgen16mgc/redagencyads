import { NextResponse } from "next/server";
import { z } from "zod";
import { latestIncrementalityStudy, listIncrementalityStudies, saveIncrementalityStudy } from "@/lib/incrementality";

const studySchema = z.object({
  id: z.string().min(1).max(120),
  method: z.enum(["geo_lift", "psa"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  lift: z.number().finite(),
  confidenceLower: z.number().finite().optional(),
  confidenceUpper: z.number().finite().optional(),
  incrementalConversions: z.number().finite().optional(),
  incrementalRevenue: z.number().finite().optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  return NextResponse.json({ studies: await listIncrementalityStudies(), latest: (await latestIncrementalityStudy()) || null });
}

export async function POST(request: Request) {
  try {
    const study = studySchema.parse(await request.json());
    if (study.endDate < study.startDate) throw new Error("endDate must be on or after startDate.");
    return NextResponse.json({ study: await saveIncrementalityStudy(study) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to ingest incrementality study." }, { status: 400 });
  }
}
