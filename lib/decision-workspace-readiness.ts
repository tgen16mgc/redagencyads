import path from "node:path";
import type { ActionAuditEntry } from "@/lib/action-audit";
import type {
  DecisionWorkspaceAcceptanceRegistry,
  DecisionWorkspaceExternalRequirementId,
} from "@/lib/decision-workspace-acceptance";
import type { PipelineSnapshot } from "@/lib/data-pipeline";
import type {
  TikTokAcceptanceGate,
  TikTokAcceptanceSnapshot,
} from "@/lib/tiktok-acceptance";

export type DecisionWorkspaceReadinessState =
  "passed" | "failed" | "awaiting_evidence" | "blocked";

export type DecisionWorkspaceReadinessGate = {
  id: TikTokAcceptanceGate["id"] | DecisionWorkspaceExternalRequirementId;
  title: string;
  state: DecisionWorkspaceReadinessState;
  acceptanceMet: boolean;
  configurationReady: boolean;
  missingConfiguration: string[];
  measuredAt?: string;
  summary: string;
  evidenceUrl?: string;
  runId?: string;
};

export type DecisionWorkspaceReadinessSnapshot = {
  checkedAt: string;
  environment: string;
  productionEnvironment: boolean;
  complete: boolean;
  passedCount: number;
  totalGates: number;
  blockedCount: number;
  awaitingEvidenceCount: number;
  failedCount: number;
  gates: DecisionWorkspaceReadinessGate[];
};

type ReadinessInput = {
  env?: Record<string, string | undefined>;
  tiktok: TikTokAcceptanceSnapshot;
  acceptance: DecisionWorkspaceAcceptanceRegistry;
  metaAuthenticated: boolean;
  googleConnected: boolean;
  linkedinConnected: boolean;
  pipeline: PipelineSnapshot;
  actions: ActionAuditEntry[];
  now?: Date;
};

function configured(
  env: Record<string, string | undefined>,
  ...keys: string[]
) {
  return keys.every((key) => Boolean(env[key]?.trim()));
}

function declaredProductionEnvironment(
  env: Record<string, string | undefined>,
) {
  const environment =
    env.DECISION_WORKSPACE_ENVIRONMENT?.trim().toLocaleLowerCase() ||
    env.VERCEL_ENV?.trim().toLocaleLowerCase() ||
    "local";
  return { environment, production: environment === "production" };
}

function genericGate(input: {
  id: DecisionWorkspaceExternalRequirementId;
  title: string;
  missingConfiguration: string[];
  automaticEvidenceMet: boolean;
  acceptance: DecisionWorkspaceAcceptanceRegistry;
  summary: string;
}) {
  const evidence = input.acceptance[input.id];
  const certifiedEvidenceMet = Boolean(
    evidence?.acceptanceMet && evidence.environment === "production",
  );
  const configurationReady = input.missingConfiguration.length === 0;
  const acceptanceMet =
    configurationReady && (input.automaticEvidenceMet || certifiedEvidenceMet);
  const state: DecisionWorkspaceReadinessState = acceptanceMet
    ? "passed"
    : !configurationReady
      ? "blocked"
      : evidence && evidence.environment === "production"
        ? "failed"
        : "awaiting_evidence";
  return {
    id: input.id,
    title: input.title,
    state,
    acceptanceMet,
    configurationReady,
    missingConfiguration: input.missingConfiguration,
    measuredAt: evidence?.measuredAt,
    summary: evidence?.summary || input.summary,
    evidenceUrl: evidence?.evidenceUrl,
    runId: evidence?.runId,
  } satisfies DecisionWorkspaceReadinessGate;
}

function tiktokGate(
  snapshot: TikTokAcceptanceSnapshot,
  id: TikTokAcceptanceGate["id"],
  extraMissingConfiguration: string[] = [],
) {
  const gate = snapshot.gates.find((item) => item.id === id)!;
  const missingConfiguration: string[] = [];
  if (id === "T1.1.1" && !snapshot.readiness.officialFeedConfigured) {
    missingConfiguration.push("TIKTOK_CCL_API_URL and TIKTOK_CCL_ACCESS_TOKEN");
  }
  if (
    ["T1.1.1", "T1.1.2", "T1.1.5"].includes(id) &&
    !snapshot.readiness.productionCertificationConfigured
  ) {
    missingConfiguration.push(
      "TIKTOK_ACCEPTANCE_TOKEN and TIKTOK_ACCEPTANCE_ENVIRONMENT=production",
    );
  }
  if (id === "T1.1.4" && !snapshot.readiness.digestDeliveryConfigured) {
    missingConfiguration.push("CRON_SECRET and a TikTok digest webhook");
  }
  if (
    id === "T1.1.4" &&
    snapshot.readiness.certificationEnvironment !== "production"
  ) {
    missingConfiguration.push("TIKTOK_ACCEPTANCE_ENVIRONMENT=production");
  }
  missingConfiguration.push(...extraMissingConfiguration);
  const configurationReady = missingConfiguration.length === 0;
  const acceptanceMet = gate.acceptanceMet && configurationReady;
  return {
    id,
    title: gate.title,
    state: acceptanceMet
      ? "passed"
      : !configurationReady
        ? "blocked"
        : gate.state,
    acceptanceMet,
    configurationReady,
    missingConfiguration,
    measuredAt: gate.measuredAt,
    summary: gate.summary,
  } satisfies DecisionWorkspaceReadinessGate;
}

export function buildDecisionWorkspaceReadiness(
  input: ReadinessInput,
): DecisionWorkspaceReadinessSnapshot {
  const env = input.env || process.env;
  const now = input.now || new Date();
  const environment = declaredProductionEnvironment(env);
  const googleConfigured = configured(
    env,
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
  );
  const linkedinConfigured = configured(
    env,
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_CLIENT_SECRET",
    "LINKEDIN_AD_ACCOUNT_ID",
  );
  const ga4Configured = configured(
    env,
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GA4_PROPERTY_ID",
  );
  const metaWriteConfigured = Boolean(
    env.META_SYSTEM_ACCESS_TOKEN?.trim() ||
    configured(env, "SESSION_SECRET", "META_APP_ID", "META_APP_SECRET"),
  );
  const googleWriteConfigured = googleConfigured;
  const directWriteConfigured = metaWriteConfigured || googleWriteConfigured;
  const scheduledWriteConfigured = Boolean(
    env.META_SYSTEM_ACCESS_TOKEN?.trim() ||
    (googleWriteConfigured &&
      (env.GOOGLE_REFRESH_TOKEN?.trim() ||
        env.GOOGLE_ADS_ACCESS_TOKEN?.trim())),
  );
  const scheduler =
    env.DECISION_WORKSPACE_SCHEDULER?.trim().toLocaleLowerCase() ||
    (env.VERCEL_ENV === "production" ? "vercel" : "");
  const schedulerConfigured = [
    "vercel",
    "airflow",
    "dagster",
    "temporal",
  ].includes(scheduler);
  const etlOrchestratorConfigured = ["airflow", "dagster", "temporal"].includes(
    scheduler,
  );
  const persistenceMode =
    env.DECISION_WORKSPACE_PERSISTENCE_MODE?.trim().toLocaleLowerCase() || "";
  const persistentDataRoot = env.DECISION_WORKSPACE_DATA_DIR?.trim() || "";
  const persistentStoreConfigured =
    persistenceMode === "persistent_volume" &&
    path.isAbsolute(persistentDataRoot);
  const successfulJobs = input.pipeline.jobs.filter(
    (job) => job.status === "succeeded",
  );
  const withinSla = (
    job: PipelineSnapshot["jobs"][number],
    maxAgeMs: number,
  ) => {
    const finishedAt = Date.parse(job.finishedAt || job.startedAt);
    const age = now.getTime() - finishedAt;
    return (
      (job.durationMs || 0) <= 4 * 60 * 60 * 1000 && age >= 0 && age <= maxAgeMs
    );
  };
  const hasIncremental = successfulJobs.some(
    (job) => job.mode === "incremental" && withinSla(job, 36 * 60 * 60 * 1000),
  );
  const hasFull = successfulJobs.some(
    (job) => job.mode === "full" && withinSla(job, 8 * 24 * 60 * 60 * 1000),
  );
  const linkedinRows = input.pipeline.performanceRows.filter(
    (row) => row.platform === "linkedin",
  );
  const applied = (action: string) =>
    input.actions.some(
      (entry) => entry.action === action && entry.status === "applied",
    );
  const appliedBudgetAction = input.actions.some(
    (entry) =>
      ["budget_change", "pacing_budget_change"].includes(entry.action) &&
      entry.status === "applied",
  );
  const resumedLearningAction = input.actions.some(
    (entry) =>
      ["budget_change", "pacing_budget_change"].includes(entry.action) &&
      entry.status === "applied" &&
      entry.resumeWhen === "learning_exit",
  );
  const production = environment.production;
  const missing = (condition: boolean, label: string) =>
    condition ? [] : [label];

  const gates: DecisionWorkspaceReadinessGate[] = [
    tiktokGate(input.tiktok, "T1.1.1"),
    tiktokGate(input.tiktok, "T1.1.2"),
    tiktokGate(
      input.tiktok,
      "T1.1.4",
      missing(schedulerConfigured, "deployed scheduler declaration"),
    ),
    tiktokGate(input.tiktok, "T1.1.5"),
    genericGate({
      id: "T1.2.1",
      title: "Google OAuth and API scopes",
      missingConfiguration: missing(
        googleConfigured,
        "Google OAuth, Ads developer token, and customer ID",
      ),
      automaticEvidenceMet: production && input.googleConnected,
      acceptance: input.acceptance,
      summary: "Complete Google browser OAuth against the approved scopes.",
    }),
    genericGate({
      id: "T1.2.2",
      title: "Google and YouTube scheduled sync",
      missingConfiguration: [
        ...missing(googleConfigured, "Google connector configuration"),
        ...missing(
          Boolean(env.GOOGLE_REFRESH_TOKEN?.trim()),
          "GOOGLE_REFRESH_TOKEN",
        ),
        ...missing(
          Boolean(env.YOUTUBE_CHANNEL_ID?.trim()),
          "YOUTUBE_CHANNEL_ID",
        ),
        ...missing(Boolean(env.CRON_SECRET?.trim()), "CRON_SECRET"),
        ...missing(schedulerConfigured, "recognized deployed scheduler declaration"),
      ],
      automaticEvidenceMet: production && hasIncremental && hasFull,
      acceptance: input.acceptance,
      summary:
        "A production incremental and full sync must both finish inside the four-hour SLA.",
    }),
    genericGate({
      id: "T1.3.1",
      title: "LinkedIn Marketing Developer onboarding",
      missingConfiguration: missing(
        linkedinConfigured,
        "LinkedIn OAuth credentials and ad account ID",
      ),
      automaticEvidenceMet: production && input.linkedinConnected,
      acceptance: input.acceptance,
      summary: "Complete LinkedIn browser OAuth with approved Ads scopes.",
    }),
    genericGate({
      id: "T1.3.2",
      title: "LinkedIn B2B metrics",
      missingConfiguration: missing(
        linkedinConfigured,
        "LinkedIn connector configuration",
      ),
      automaticEvidenceMet: production && linkedinRows.length > 0,
      acceptance: input.acceptance,
      summary:
        "Load production lead-gen, company-engagement, and job-title reporting rows.",
    }),
    genericGate({
      id: "T1.3.3",
      title: "LinkedIn account-based reporting",
      missingConfiguration: missing(
        linkedinConfigured,
        "LinkedIn connector configuration",
      ),
      automaticEvidenceMet:
        production && linkedinRows.some((row) => Boolean(row.audienceSegment)),
      acceptance: input.acceptance,
      summary:
        "Prove a target-account rollup from live LinkedIn reporting data.",
    }),
    genericGate({
      id: "T2.1.2",
      title: "Production ETL orchestration",
      missingConfiguration: [
        ...missing(Boolean(env.CRON_SECRET?.trim()), "CRON_SECRET"),
        ...missing(
          etlOrchestratorConfigured,
          "Airflow, Dagster, or Temporal orchestrator declaration",
        ),
        ...missing(
          persistentStoreConfigured,
          "persistent_volume mode with an absolute DECISION_WORKSPACE_DATA_DIR",
        ),
      ],
      automaticEvidenceMet: production && hasIncremental && hasFull,
      acceptance: input.acceptance,
      summary:
        "Run idempotent incremental and full jobs on deployed persistent infrastructure inside four hours.",
    }),
    genericGate({
      id: "T2.2.3",
      title: "GA4 data-driven attribution",
      missingConfiguration: missing(
        ga4Configured,
        "Google OAuth credentials and GA4_PROPERTY_ID",
      ),
      automaticEvidenceMet: false,
      acceptance: input.acceptance,
      summary:
        "Verify a live GA4 property whose reporting attribution model is data-driven.",
    }),
    genericGate({
      id: "T3.1.5",
      title: "Provider-backed creative clustering",
      missingConfiguration: missing(
        Boolean(env.CREATIVE_INFERENCE_URL?.trim()),
        "CREATIVE_INFERENCE_URL",
      ),
      automaticEvidenceMet: false,
      acceptance: input.acceptance,
      summary:
        "Record a provider-backed CLIP or video-embedding clustering run.",
    }),
    genericGate({
      id: "T3.3.2",
      title: "Provider-backed element detection",
      missingConfiguration: missing(
        Boolean(env.CREATIVE_INFERENCE_URL?.trim()),
        "CREATIVE_INFERENCE_URL",
      ),
      automaticEvidenceMet: false,
      acceptance: input.acceptance,
      summary:
        "Record provider-backed object, face, text-overlay, and CTA detection evidence.",
    }),
    genericGate({
      id: "T3.3.4",
      title: "Provider-backed audio classification",
      missingConfiguration: missing(
        Boolean(env.CREATIVE_INFERENCE_URL?.trim()),
        "CREATIVE_INFERENCE_URL",
      ),
      automaticEvidenceMet: false,
      acceptance: input.acceptance,
      summary:
        "Record provider-backed raw-audio mood, tempo, and voice classification evidence.",
    }),
    genericGate({
      id: "T4.1.1",
      title: "Live pacing and spend control",
      missingConfiguration: missing(
        directWriteConfigured,
        "Meta or Google write credentials",
      ),
      automaticEvidenceMet: production && applied("pacing_budget_change"),
      acceptance: input.acceptance,
      summary:
        "Apply a production pacing adjustment through a permitted Ads API.",
    }),
    genericGate({
      id: "T4.1.2",
      title: "Live underspend and overspend alerts",
      missingConfiguration: [
        ...missing(Boolean(env.CRON_SECRET?.trim()), "CRON_SECRET"),
        ...missing(schedulerConfigured, "deployed scheduler declaration"),
        ...missing(
          Boolean(env.BUDGET_ALERT_TOTAL_BUDGET?.trim()),
          "BUDGET_ALERT_TOTAL_BUDGET",
        ),
        ...missing(
          Boolean(
            env.BUDGET_ALERT_SLACK_WEBHOOK?.trim() ||
            env.BUDGET_ALERT_EMAIL_WEBHOOK?.trim() ||
            env.SLACK_WEBHOOK_URL?.trim() ||
            env.EMAIL_WEBHOOK_URL?.trim(),
          ),
          "budget alert webhook",
        ),
      ],
      automaticEvidenceMet: false,
      acceptance: input.acceptance,
      summary: "Record a successful deployed pacing alert delivery.",
    }),
    genericGate({
      id: "T4.1.3",
      title: "Live platform cap enforcement",
      missingConfiguration: missing(
        directWriteConfigured,
        "Meta or Google write credentials",
      ),
      automaticEvidenceMet: production && applied("platform_cap_enforcement"),
      acceptance: input.acceptance,
      summary:
        "Apply and audit a production hard-stop or redistribution action.",
    }),
    genericGate({
      id: "T4.1.4",
      title: "Live dayparting and bid schedules",
      missingConfiguration: missing(
        directWriteConfigured,
        "Meta or Google write credentials",
      ),
      automaticEvidenceMet: production && applied("daypart_schedule"),
      acceptance: input.acceptance,
      summary: "Apply and audit a production daypart schedule.",
    }),
    genericGate({
      id: "T4.2.5",
      title: "Live one-click budget application",
      missingConfiguration: missing(
        directWriteConfigured,
        "Meta or Google write credentials",
      ),
      automaticEvidenceMet: production && appliedBudgetAction,
      acceptance: input.acceptance,
      summary:
        "Apply a recommended Meta or Google budget change and retain its audit record.",
    }),
    genericGate({
      id: "T4.3.3",
      title: "Learning-phase protection and resume",
      missingConfiguration: [
        ...missing(Boolean(env.CRON_SECRET?.trim()), "CRON_SECRET"),
        ...missing(schedulerConfigured, "deployed scheduler declaration"),
        ...missing(
          scheduledWriteConfigured,
          "scheduled Meta or Google write credentials",
        ),
      ],
      automaticEvidenceMet: production && resumedLearningAction,
      acceptance: input.acceptance,
      summary:
        "Record a real deferred action that resumed after provider-confirmed learning exit.",
    }),
  ];

  const passedCount = gates.filter((gate) => gate.acceptanceMet).length;
  return {
    checkedAt: now.toISOString(),
    environment: environment.environment,
    productionEnvironment: production,
    complete: passedCount === gates.length,
    passedCount,
    totalGates: gates.length,
    blockedCount: gates.filter((gate) => gate.state === "blocked").length,
    awaitingEvidenceCount: gates.filter(
      (gate) => gate.state === "awaiting_evidence",
    ).length,
    failedCount: gates.filter((gate) => gate.state === "failed").length,
    gates,
  };
}
