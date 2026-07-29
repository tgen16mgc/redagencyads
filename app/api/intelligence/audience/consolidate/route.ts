import { NextResponse } from "next/server";
import { z } from "zod";
import { graphRequest } from "@/lib/meta-graph";
import { requireToken, sessionErrorStatus } from "@/lib/session";
import { recordAction } from "@/lib/action-audit";

const bodySchema = z.object({
  action: z.enum(["merge", "exclude"]),
  leftId: z.string().min(1).max(120),
  rightId: z.string().min(1).max(120),
  overlap: z.number().finite().min(0).max(1),
  apply: z.boolean().default(false),
  targeting: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (!body.apply) {
      return NextResponse.json({ audit: await recordAction({ action: `audience_${body.action}`, target: body.rightId, status: "planned", details: body }) });
    }
    if (body.action === "merge") {
      return NextResponse.json({ error: "Meta does not expose an atomic ad-set merge API; use the audited dry run and consolidate manually." }, { status: 501 });
    }
    if (!body.targeting || Object.keys(body.targeting).length === 0) {
      return NextResponse.json({ error: "Explicit Meta targeting payload is required before applying an audience exclusion." }, { status: 400 });
    }
    const token = await requireToken();
    const payload = new URLSearchParams({ targeting: JSON.stringify(body.targeting) });
    await graphRequest({ path: `/${body.rightId}`, method: "POST", body: payload, token });
    return NextResponse.json({ audit: await recordAction({ action: `audience_${body.action}`, target: body.rightId, status: "applied", appliedAt: new Date().toISOString(), details: body }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply audience consolidation.";
    return NextResponse.json({ error: message }, { status: sessionErrorStatus(error) });
  }
}
