import { NextResponse } from "next/server";
import { z } from "zod";
import { assignStoredExperiment, getDefaultExperimentAssignmentStore, releaseStoredExperiment } from "@/lib/experiment-assignment-store";

const schema = z.object({ experimentId: z.string().min(1), layer: z.string().min(1), unitId: z.string().min(1), treatmentAllocation: z.number().min(0).max(1), trafficAllocation: z.number().min(0).max(1).optional() });

export async function POST(request: Request) {
  try { return NextResponse.json({ assignment: await assignStoredExperiment(getDefaultExperimentAssignmentStore(), schema.parse(await request.json())) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to assign experiment." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const { experimentId } = z.object({ experimentId: z.string().min(1) }).parse(await request.json());
    return NextResponse.json({ release: await releaseStoredExperiment(getDefaultExperimentAssignmentStore(), experimentId) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to release experiment assignments." }, { status: 400 }); }
}
