import path from "node:path";
import os from "node:os";
import { timingSafeEqual } from "node:crypto";
import { workspaceDataPath } from "@/lib/workspace-storage";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { readTikTokWatchlist } from "@/lib/tiktok-watchlist";

export type TikTokAcceptanceCertification = {
  certifiedAt: string;
  environment: string;
  cohortLabel?: string;
  requestOrigin: string;
  method: "operator_token";
};

export type TikTokAcceptanceEvidence = {
  coverage?: {
    measuredAt: string;
    region: string;
    queried: number;
    matched: number;
    coverage: number;
    acceptanceMet: boolean;
    officialFeedUsed: boolean;
    sourceActorIds: string[];
    certification?: TikTokAcceptanceCertification;
  };
  ingestion?: {
    measuredAt: string;
    actorId: string;
    officialFeedUsed: boolean;
    pipelineDurationMs: number;
    normalizationDurationMs: number;
    normalizedWithin15Minutes: boolean;
    certification?: TikTokAcceptanceCertification;
  };
  deduplication?: {
    measuredAt: string;
    sampleSize: number;
    expectedUniqueCount: number;
    predictedUniqueCount: number;
    precision: number;
    recall: number;
    deduplicationAccuracy: number;
    acceptanceMet: boolean;
    certification?: TikTokAcceptanceCertification;
  };
  search?: {
    measuredAt: string;
    recordCount: number;
    resultCount: number;
    durationMs: number;
    acceptanceMet: boolean;
    certification?: TikTokAcceptanceCertification;
  };
  scoring?: {
    measuredAt: string;
    sampleSize: number;
    correlation: number;
    absoluteCorrelation: number;
    dateEvidenceComplete: boolean;
    observationWindowStart: string | null;
    observationWindowEnd: string | null;
    observationWindowDays: number;
    acceptanceMet: boolean;
    certification?: TikTokAcceptanceCertification;
  };
};

export type TikTokAcceptanceGateState =
  | "passed"
  | "failed"
  | "awaiting_evidence"
  | "blocked";

export type TikTokAcceptanceGate = {
  id: "T1.1.1" | "T1.1.2" | "T1.1.3" | "T1.1.4" | "T1.1.5";
  title: string;
  state: TikTokAcceptanceGateState;
  acceptanceMet: boolean;
  measuredAt?: string;
  summary: string;
};

export type TikTokAcceptanceSnapshot = {
  checkedAt: string;
  passedCount: number;
  totalGates: number;
  readiness: {
    officialFeedConfigured: boolean;
    digestDeliveryConfigured: boolean;
    acceptanceTokenConfigured: boolean;
    certificationEnvironment: string;
    productionCertificationConfigured: boolean;
  };
  gates: TikTokAcceptanceGate[];
  evidence: TikTokAcceptanceEvidence;
};

function evidencePath() {
  return (
    process.env.TIKTOK_ACCEPTANCE_PATH ||
    (process.env.NODE_ENV === "test"
      ? path.join(
          os.tmpdir(),
          `redagencyads-tiktok-acceptance-${process.pid}.json`,
        )
      : undefined) ||
    workspaceDataPath("tiktok-acceptance.json")
  );
}

export async function readTikTokAcceptanceEvidence(): Promise<TikTokAcceptanceEvidence> {
  try {
    return JSON.parse(
      await readFile(evidencePath(), "utf8"),
    ) as TikTokAcceptanceEvidence;
  } catch {
    return {};
  }
}

let evidenceWriteQueue: Promise<void> = Promise.resolve();

export async function recordTikTokAcceptanceEvidence(
  patch: Partial<TikTokAcceptanceEvidence>,
) {
  let next: TikTokAcceptanceEvidence = {};
  evidenceWriteQueue = evidenceWriteQueue.catch(() => undefined).then(async () => {
    next = { ...(await readTikTokAcceptanceEvidence()), ...patch };
    const target = evidencePath();
    await mkdir(path.dirname(target), { recursive: true });
    const temporaryPath = `${target}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(next, null, 2), "utf8");
    await rename(temporaryPath, target);
  });
  await evidenceWriteQueue;
  return next;
}

export type TikTokAcceptanceRecordingResult = {
  recorded: boolean;
  reason:
    | "recorded"
    | "not_requested"
    | "token_not_configured"
    | "unauthorized";
  certification?: TikTokAcceptanceCertification;
};

export async function certifyTikTokAcceptanceEvidence(
  request: Request,
  patch: Partial<TikTokAcceptanceEvidence>,
): Promise<TikTokAcceptanceRecordingResult> {
  const suppliedToken = acceptanceRequestToken(request);
  if (!suppliedToken) return { recorded: false, reason: "not_requested" };

  const configuredToken = process.env.TIKTOK_ACCEPTANCE_TOKEN?.trim();
  if (!configuredToken) {
    return { recorded: false, reason: "token_not_configured" };
  }
  if (!tokensMatch(configuredToken, suppliedToken)) {
    return { recorded: false, reason: "unauthorized" };
  }

  const certification: TikTokAcceptanceCertification = {
    certifiedAt: new Date().toISOString(),
    environment: certificationEnvironment(),
    cohortLabel:
      request.headers.get("x-acceptance-cohort")?.trim().slice(0, 240) ||
      undefined,
    requestOrigin: new URL(request.url).origin,
    method: "operator_token",
  };
  const certifiedPatch = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      key,
      value ? { ...value, certification } : value,
    ]),
  ) as Partial<TikTokAcceptanceEvidence>;
  await recordTikTokAcceptanceEvidence(certifiedPatch);
  return { recorded: true, reason: "recorded", certification };
}

function acceptanceRequestToken(request: Request) {
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

function certificationEnvironment() {
  return (
    process.env.TIKTOK_ACCEPTANCE_ENVIRONMENT?.trim().toLocaleLowerCase() ||
    "unspecified"
  );
}

function isProductionCertified(
  evidence:
    | { certification?: TikTokAcceptanceCertification }
    | undefined,
) {
  return evidence?.certification?.environment === "production";
}

export async function buildTikTokAcceptanceSnapshot(): Promise<TikTokAcceptanceSnapshot> {
  const [evidence, watchlist] = await Promise.all([
    readTikTokAcceptanceEvidence(),
    readTikTokWatchlist(),
  ]);
  const officialFeedConfigured = Boolean(
    process.env.TIKTOK_CCL_API_URL && process.env.TIKTOK_CCL_ACCESS_TOKEN,
  );
  const digestDeliveryConfigured = Boolean(
    process.env.CRON_SECRET &&
      (process.env.TIKTOK_DIGEST_SLACK_WEBHOOK ||
        process.env.TIKTOK_DIGEST_EMAIL_WEBHOOK),
  );
  const acceptanceTokenConfigured = Boolean(
    process.env.TIKTOK_ACCEPTANCE_TOKEN?.trim(),
  );
  const configuredCertificationEnvironment = certificationEnvironment();
  const productionCertificationConfigured =
    acceptanceTokenConfigured &&
    configuredCertificationEnvironment === "production";

  const coverage = evidence.coverage;
  const coveragePassed = Boolean(
    officialFeedConfigured &&
      coverage?.officialFeedUsed &&
      coverage.acceptanceMet &&
      isProductionCertified(coverage),
  );
  const ingestion = evidence.ingestion;
  const deduplication = evidence.deduplication;
  const ingestionPassed = Boolean(
    ingestion?.normalizedWithin15Minutes &&
      deduplication?.acceptanceMet &&
      isProductionCertified(ingestion) &&
      isProductionCertified(deduplication),
  );
  const delivery = watchlist.lastDigestDelivery;
  const deliveryPassed = Boolean(
    delivery?.acceptanceMet && delivery.certificationEnvironment === "production",
  );
  const searchPassed = Boolean(
    evidence.search?.acceptanceMet && isProductionCertified(evidence.search),
  );
  const scoringPassed = Boolean(
    evidence.scoring?.acceptanceMet && isProductionCertified(evidence.scoring),
  );

  const gates: TikTokAcceptanceGate[] = [
    {
      id: "T1.1.1",
      title: "Restore approved API access",
      state: coveragePassed
        ? "passed"
        : !officialFeedConfigured
          ? "blocked"
          : !productionCertificationConfigured
            ? "blocked"
          : coverage
            ? isProductionCertified(coverage)
              ? "failed"
              : "awaiting_evidence"
            : "awaiting_evidence",
      acceptanceMet: coveragePassed,
      measuredAt: coverage?.measuredAt,
      summary: !officialFeedConfigured
        ? "Approved TikTok CCL or partner-feed credentials are not configured."
        : !productionCertificationConfigured
          ? "Production evidence certification requires TIKTOK_ACCEPTANCE_TOKEN and TIKTOK_ACCEPTANCE_ENVIRONMENT=production."
        : !coverage
          ? "Run an advertiser-handle coverage cohort against the approved feed."
          : !coverage.officialFeedUsed
            ? "The latest cohort used a fallback source, so it cannot prove API reactivation."
            : `${(coverage.coverage * 100).toFixed(1)}% of ${coverage.queried} advertiser handles returned a match.`,
    },
    {
      id: "T1.1.2",
      title: "Prove ingestion and deduplication",
      state: ingestionPassed
        ? "passed"
        : !productionCertificationConfigured
          ? "blocked"
          : ingestion && deduplication
            ? isProductionCertified(ingestion) &&
              isProductionCertified(deduplication)
              ? "failed"
              : "awaiting_evidence"
            : "awaiting_evidence",
      acceptanceMet: ingestionPassed,
      measuredAt:
        ingestion && deduplication
          ? new Date(
              Math.max(
                Date.parse(ingestion.measuredAt),
                Date.parse(deduplication.measuredAt),
              ),
            ).toISOString()
          : ingestion?.measuredAt || deduplication?.measuredAt,
      summary:
        !productionCertificationConfigured
          ? "Configure production evidence certification before recording ingestion or labeled deduplication cohorts."
          : ingestion && deduplication
          ? `${(ingestion.pipelineDurationMs / 1000).toFixed(1)}s raw-to-normalized; ${(deduplication.deduplicationAccuracy * 100).toFixed(2)}% labeled deduplication F1.`
          : "Both production ingestion telemetry and a labeled deduplication cohort are required.",
    },
    {
      id: "T1.1.3",
      title: "Benchmark search and filters",
      state: searchPassed
        ? "passed"
        : !productionCertificationConfigured
          ? "blocked"
          : evidence.search
            ? isProductionCertified(evidence.search)
              ? "failed"
              : "awaiting_evidence"
            : "awaiting_evidence",
      acceptanceMet: searchPassed,
      measuredAt: evidence.search?.measuredAt,
      summary: !productionCertificationConfigured
        ? "Configure production evidence certification before recording the 10,000-row benchmark."
        : evidence.search
        ? `${evidence.search.recordCount.toLocaleString()} records searched in ${evidence.search.durationMs.toFixed(1)}ms.`
        : "Run the benchmark with at least 10,000 catalog records.",
    },
    {
      id: "T1.1.4",
      title: "Deliver the daily watchlist digest",
      state: deliveryPassed
        ? "passed"
        : !digestDeliveryConfigured
          ? "blocked"
          : configuredCertificationEnvironment !== "production"
            ? "blocked"
          : delivery
            ? "failed"
            : "awaiting_evidence",
      acceptanceMet: deliveryPassed,
      measuredAt: delivery?.deliveredAt,
      summary: !digestDeliveryConfigured
        ? "CRON_SECRET and at least one TikTok digest webhook are required."
        : configuredCertificationEnvironment !== "production"
          ? "Set TIKTOK_ACCEPTANCE_ENVIRONMENT=production before certifying digest delivery."
        : delivery
          ? `Last successful delivery reached ${delivery.deliveredChannels.join(", ")} at ${delivery.deliveredForLocalTime || `${delivery.deliveredForLocalHour}:00`} local time (${delivery.deliveryTimezone}).`
          : "No successful deployed digest delivery has been recorded.",
    },
    {
      id: "T1.1.5",
      title: "Validate creative score against CPA",
      state: scoringPassed
        ? "passed"
        : !productionCertificationConfigured
          ? "blocked"
          : evidence.scoring
            ? isProductionCertified(evidence.scoring)
              ? "failed"
              : "awaiting_evidence"
            : "awaiting_evidence",
      acceptanceMet: scoringPassed,
      measuredAt: evidence.scoring?.measuredAt,
      summary: !productionCertificationConfigured
        ? "Configure production evidence certification before recording the client score-to-CPA cohort."
        : evidence.scoring
        ? `|r| ${evidence.scoring.absoluteCorrelation.toFixed(3)} across ${evidence.scoring.observationWindowDays} inclusive days and ${evidence.scoring.sampleSize} observations.`
        : "Submit a dated client score-to-CPA cohort spanning at least 30 days.",
    },
  ];

  return {
    checkedAt: new Date().toISOString(),
    passedCount: gates.filter((gate) => gate.acceptanceMet).length,
    totalGates: gates.length,
    readiness: {
      officialFeedConfigured,
      digestDeliveryConfigured,
      acceptanceTokenConfigured,
      certificationEnvironment: configuredCertificationEnvironment,
      productionCertificationConfigured,
    },
    gates,
    evidence,
  };
}
