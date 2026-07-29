import { timingSafeEqual } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { workspaceDataPath } from "@/lib/workspace-storage";

export const DECISION_WORKSPACE_EXTERNAL_REQUIREMENT_IDS = [
  "T1.2.1",
  "T1.2.2",
  "T1.3.1",
  "T1.3.2",
  "T1.3.3",
  "T2.1.2",
  "T2.2.3",
  "T3.1.5",
  "T3.3.2",
  "T3.3.4",
  "T4.1.1",
  "T4.1.2",
  "T4.1.3",
  "T4.1.4",
  "T4.2.5",
  "T4.3.3",
] as const;

export type DecisionWorkspaceExternalRequirementId =
  (typeof DECISION_WORKSPACE_EXTERNAL_REQUIREMENT_IDS)[number];

export type DecisionWorkspaceAcceptanceEvidence = {
  requirementId: DecisionWorkspaceExternalRequirementId;
  measuredAt: string;
  acceptanceMet: boolean;
  summary: string;
  evidenceUrl?: string;
  runId?: string;
  certifiedAt: string;
  environment: string;
  requestOrigin: string;
  method: "operator_token" | "automatic";
};

type AcceptanceEvidenceInput = Omit<
  DecisionWorkspaceAcceptanceEvidence,
  "certifiedAt" | "environment" | "requestOrigin" | "method"
>;

export type DecisionWorkspaceAcceptanceRegistry = Partial<
  Record<
    DecisionWorkspaceExternalRequirementId,
    DecisionWorkspaceAcceptanceEvidence
  >
>;

function registryPath() {
  return (
    process.env.DECISION_WORKSPACE_ACCEPTANCE_PATH ||
    (process.env.NODE_ENV === "test"
      ? path.join(
          os.tmpdir(),
          `redagencyads-decision-workspace-acceptance-${process.pid}.json`,
        )
      : workspaceDataPath("decision-workspace-acceptance.json"))
  );
}

export async function readDecisionWorkspaceAcceptanceEvidence(): Promise<DecisionWorkspaceAcceptanceRegistry> {
  try {
    return JSON.parse(
      await readFile(registryPath(), "utf8"),
    ) as DecisionWorkspaceAcceptanceRegistry;
  } catch {
    return {};
  }
}

let writeQueue: Promise<void> = Promise.resolve();

export async function recordDecisionWorkspaceAcceptanceEvidence(
  evidence: DecisionWorkspaceAcceptanceEvidence,
) {
  let next: DecisionWorkspaceAcceptanceRegistry = {};
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      next = {
        ...(await readDecisionWorkspaceAcceptanceEvidence()),
        [evidence.requirementId]: evidence,
      };
      const target = registryPath();
      await mkdir(path.dirname(target), { recursive: true });
      const temporaryPath = `${target}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(next, null, 2), "utf8");
      await rename(temporaryPath, target);
    });
  await writeQueue;
  return next;
}

function requestToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLocaleLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  return request.headers.get("x-acceptance-token")?.trim() || undefined;
}

function tokensMatch(configured: string, supplied: string) {
  const configuredBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return (
    configuredBytes.length === suppliedBytes.length &&
    timingSafeEqual(configuredBytes, suppliedBytes)
  );
}

export async function certifyDecisionWorkspaceAcceptanceEvidence(
  request: Request,
  input: AcceptanceEvidenceInput,
) {
  const suppliedToken = requestToken(request);
  if (!suppliedToken)
    return { recorded: false, reason: "not_requested" } as const;
  const configuredToken =
    process.env.DECISION_WORKSPACE_ACCEPTANCE_TOKEN?.trim();
  if (!configuredToken) {
    return { recorded: false, reason: "token_not_configured" } as const;
  }
  if (!tokensMatch(configuredToken, suppliedToken)) {
    return { recorded: false, reason: "unauthorized" } as const;
  }

  const evidence: DecisionWorkspaceAcceptanceEvidence = {
    ...input,
    certifiedAt: new Date().toISOString(),
    environment:
      process.env.DECISION_WORKSPACE_ACCEPTANCE_ENVIRONMENT?.trim().toLocaleLowerCase() ||
      "unspecified",
    requestOrigin: new URL(request.url).origin,
    method: "operator_token",
  };
  await recordDecisionWorkspaceAcceptanceEvidence(evidence);
  return { recorded: true, reason: "recorded", evidence } as const;
}

export async function recordAutomaticDecisionWorkspaceAcceptanceEvidence(
  input: AcceptanceEvidenceInput & { requestOrigin: string },
) {
  const workspaceEnvironment =
    process.env.DECISION_WORKSPACE_ENVIRONMENT?.trim().toLocaleLowerCase() ||
    process.env.VERCEL_ENV?.trim().toLocaleLowerCase() ||
    "local";
  const acceptanceEnvironment =
    process.env.DECISION_WORKSPACE_ACCEPTANCE_ENVIRONMENT?.trim().toLocaleLowerCase() ||
    "unspecified";
  if (
    workspaceEnvironment !== "production" ||
    acceptanceEnvironment !== "production"
  ) {
    return { recorded: false, reason: "non_production" } as const;
  }
  if (!input.acceptanceMet) {
    return { recorded: false, reason: "acceptance_not_met" } as const;
  }
  if (!input.evidenceUrl && !input.runId) {
    return { recorded: false, reason: "traceability_required" } as const;
  }

  const { requestOrigin, ...measurement } = input;
  const evidence: DecisionWorkspaceAcceptanceEvidence = {
    ...measurement,
    certifiedAt: new Date().toISOString(),
    environment: "production",
    requestOrigin,
    method: "automatic",
  };
  await recordDecisionWorkspaceAcceptanceEvidence(evidence);
  return { recorded: true, reason: "recorded", evidence } as const;
}
