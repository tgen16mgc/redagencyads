import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  connectorTokenNeedsRefresh,
  decryptConnectorToken,
} from "@/lib/connector-oauth";
import { getDefaultActionAuditStore } from "@/lib/action-audit";
import {
  certifyDecisionWorkspaceAcceptanceEvidence,
  DECISION_WORKSPACE_EXTERNAL_REQUIREMENT_IDS,
  readDecisionWorkspaceAcceptanceEvidence,
} from "@/lib/decision-workspace-acceptance";
import { buildDecisionWorkspaceReadiness } from "@/lib/decision-workspace-readiness";
import { getDefaultPipelineStore } from "@/lib/data-pipeline";
import { hasTokenSession } from "@/lib/session";
import { buildTikTokAcceptanceSnapshot } from "@/lib/tiktok-acceptance";

const evidenceSchema = z
  .object({
    requirementId: z.enum(DECISION_WORKSPACE_EXTERNAL_REQUIREMENT_IDS),
    measuredAt: z.string().datetime(),
    acceptanceMet: z.boolean(),
    summary: z.string().min(1).max(1000),
    evidenceUrl: z.string().url().max(2000).optional(),
    runId: z.string().min(1).max(240).optional(),
  })
  .refine((value) => value.evidenceUrl || value.runId, {
    message: "evidenceUrl or runId is required for traceability.",
    path: ["evidenceUrl"],
  });

async function readinessSnapshot() {
  const store = await cookies();
  const googleSession = decryptConnectorToken(
    store.get("connector_token_google")?.value,
  );
  const linkedinSession = decryptConnectorToken(
    store.get("connector_token_linkedin")?.value,
  );
  const [tiktok, acceptance, pipeline, actions, metaAuthenticated] =
    await Promise.all([
      buildTikTokAcceptanceSnapshot(),
      readDecisionWorkspaceAcceptanceEvidence(),
      getDefaultPipelineStore().read(),
      getDefaultActionAuditStore().read(),
      hasTokenSession(),
    ]);
  return buildDecisionWorkspaceReadiness({
    tiktok,
    acceptance,
    pipeline,
    actions,
    metaAuthenticated,
    googleConnected: Boolean(
      googleSession &&
      googleSession.provider === "google" &&
      !connectorTokenNeedsRefresh(googleSession),
    ),
    linkedinConnected: Boolean(
      linkedinSession &&
      linkedinSession.provider === "linkedin" &&
      !connectorTokenNeedsRefresh(linkedinSession),
    ),
  });
}

export async function GET() {
  return NextResponse.json({ readiness: await readinessSnapshot() });
}

export async function POST(request: Request) {
  try {
    const evidence = evidenceSchema.parse(await request.json());
    const recording = await certifyDecisionWorkspaceAcceptanceEvidence(
      request,
      evidence,
    );
    const status = recording.recorded
      ? 200
      : recording.reason === "token_not_configured"
        ? 503
        : 401;
    return NextResponse.json(
      {
        recording,
        readiness: await readinessSnapshot(),
      },
      { status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record readiness evidence.",
      },
      { status: 400 },
    );
  }
}
