import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  certifyDecisionWorkspaceAcceptanceEvidence,
  DECISION_WORKSPACE_EXTERNAL_REQUIREMENT_IDS,
  recordAutomaticDecisionWorkspaceAcceptanceEvidence,
  readDecisionWorkspaceAcceptanceEvidence,
  type DecisionWorkspaceAcceptanceRegistry,
} from "../decision-workspace-acceptance";
import { buildDecisionWorkspaceReadiness } from "../decision-workspace-readiness";
import type { TikTokAcceptanceSnapshot } from "../tiktok-acceptance";

function tiktokSnapshot(passed = false): TikTokAcceptanceSnapshot {
  const ids = ["T1.1.1", "T1.1.2", "T1.1.3", "T1.1.4", "T1.1.5"] as const;
  return {
    checkedAt: "2026-07-29T00:00:00.000Z",
    passedCount: passed ? 5 : 0,
    totalGates: 5,
    readiness: {
      officialFeedConfigured: passed,
      digestDeliveryConfigured: passed,
      acceptanceTokenConfigured: passed,
      certificationEnvironment: passed ? "production" : "unspecified",
      productionCertificationConfigured: passed,
    },
    gates: ids.map((id) => ({
      id,
      title: id,
      state: passed ? "passed" : "blocked",
      acceptanceMet: passed,
      summary: passed
        ? "Production evidence passed."
        : "Configuration missing.",
    })),
    evidence: {},
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    env: {},
    tiktok: tiktokSnapshot(),
    acceptance: {},
    metaAuthenticated: false,
    googleConnected: false,
    linkedinConnected: false,
    pipeline: { performanceRows: [], creativeRows: [], jobs: [] },
    actions: [],
    now: new Date("2026-07-29T00:00:00.000Z"),
    ...overrides,
  };
}

function productionEnv() {
  return {
    DECISION_WORKSPACE_ENVIRONMENT: "production",
    DECISION_WORKSPACE_SCHEDULER: "airflow",
    DECISION_WORKSPACE_PERSISTENCE_MODE: "persistent_volume",
    DECISION_WORKSPACE_DATA_DIR: "/var/lib/decision-workspace",
    SESSION_SECRET: "session",
    META_APP_ID: "meta-id",
    META_APP_SECRET: "meta-secret",
    META_SYSTEM_ACCESS_TOKEN: "meta-system",
    GOOGLE_CLIENT_ID: "google-id",
    GOOGLE_CLIENT_SECRET: "google-secret",
    GOOGLE_ADS_DEVELOPER_TOKEN: "developer",
    GOOGLE_ADS_CUSTOMER_ID: "123",
    GOOGLE_REFRESH_TOKEN: "google-refresh",
    YOUTUBE_CHANNEL_ID: "channel",
    GA4_PROPERTY_ID: "property",
    LINKEDIN_CLIENT_ID: "linkedin-id",
    LINKEDIN_CLIENT_SECRET: "linkedin-secret",
    LINKEDIN_AD_ACCOUNT_ID: "linkedin-account",
    CRON_SECRET: "cron",
    CREATIVE_INFERENCE_URL: "https://inference.example.test",
    BUDGET_ALERT_TOTAL_BUDGET: "1000",
    BUDGET_ALERT_SLACK_WEBHOOK: "https://hooks.example.test/budget",
  };
}

describe("Decision Workspace readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists all twenty external gates and blocks missing configuration", () => {
    const snapshot = buildDecisionWorkspaceReadiness(input());

    expect(snapshot).toMatchObject({
      complete: false,
      passedCount: 0,
      totalGates: 20,
      productionEnvironment: false,
    });
    expect(snapshot.gates.map((gate) => gate.id)).toHaveLength(20);
    expect(snapshot.gates.find((gate) => gate.id === "T1.2.1")).toMatchObject({
      state: "blocked",
      configurationReady: false,
    });
  });

  it("only completes when every external gate has production evidence", () => {
    const acceptance = Object.fromEntries(
      DECISION_WORKSPACE_EXTERNAL_REQUIREMENT_IDS.map((requirementId) => [
        requirementId,
        {
          requirementId,
          measuredAt: "2026-07-29T00:00:00.000Z",
          acceptanceMet: true,
          summary: `${requirementId} passed in production.`,
          runId: `run-${requirementId}`,
          certifiedAt: "2026-07-29T00:01:00.000Z",
          environment: "production",
          requestOrigin: "https://workspace.example.test",
          method: "operator_token",
        },
      ]),
    ) as DecisionWorkspaceAcceptanceRegistry;

    const snapshot = buildDecisionWorkspaceReadiness(
      input({
        env: productionEnv(),
        tiktok: tiktokSnapshot(true),
        acceptance,
      }),
    );

    expect(snapshot).toMatchObject({
      complete: true,
      passedCount: 20,
      totalGates: 20,
      blockedCount: 0,
      awaitingEvidenceCount: 0,
      failedCount: 0,
    });
  });

  it("does not accept non-production certification as completion proof", () => {
    const requirementId = "T3.1.5";
    const snapshot = buildDecisionWorkspaceReadiness(
      input({
        env: productionEnv(),
        acceptance: {
          [requirementId]: {
            requirementId,
            measuredAt: "2026-07-29T00:00:00.000Z",
            acceptanceMet: true,
            summary: "Local model smoke passed.",
            runId: "local-run",
            certifiedAt: "2026-07-29T00:01:00.000Z",
            environment: "local",
            requestOrigin: "http://localhost:3000",
            method: "operator_token",
          },
        },
      }),
    );

    expect(
      snapshot.gates.find((gate) => gate.id === requirementId),
    ).toMatchObject({
      acceptanceMet: false,
      state: "awaiting_evidence",
    });
  });

  it("requires a real ETL orchestrator and mounted data root", () => {
    const snapshot = buildDecisionWorkspaceReadiness(
      input({
        env: {
          ...productionEnv(),
          DECISION_WORKSPACE_SCHEDULER: "vercel",
          DECISION_WORKSPACE_DATA_DIR: "relative/data",
        },
      }),
    );

    expect(snapshot.gates.find((gate) => gate.id === "T2.1.2")).toMatchObject({
      configurationReady: false,
      state: "blocked",
      missingConfiguration: expect.arrayContaining([
        "Airflow, Dagster, or Temporal orchestrator declaration",
        "persistent_volume mode with an absolute DECISION_WORKSPACE_DATA_DIR",
      ]),
    });
  });

  it("records traceable operator evidence with constant-time token auth", async () => {
    const requirementId = "T2.2.3";
    vi.stubEnv("DECISION_WORKSPACE_ACCEPTANCE_TOKEN", "operator-token");
    vi.stubEnv("DECISION_WORKSPACE_ACCEPTANCE_ENVIRONMENT", "production");
    vi.stubEnv(
      "DECISION_WORKSPACE_ACCEPTANCE_PATH",
      path.join(
        os.tmpdir(),
        `decision-workspace-acceptance-${process.pid}-${Date.now()}.json`,
      ),
    );
    const request = new Request(
      "https://workspace.example.test/api/readiness",
      {
        method: "POST",
        headers: { authorization: "Bearer operator-token" },
      },
    );

    const result = await certifyDecisionWorkspaceAcceptanceEvidence(request, {
      requirementId,
      measuredAt: "2026-07-29T00:00:00.000Z",
      acceptanceMet: true,
      summary: "GA4 property reported data-driven attribution.",
      runId: "ga4-run-123",
    });

    expect(result).toMatchObject({
      recorded: true,
      evidence: { requirementId, environment: "production" },
    });
    expect(await readDecisionWorkspaceAcceptanceEvidence()).toMatchObject({
      [requirementId]: {
        acceptanceMet: true,
        runId: "ga4-run-123",
      },
    });
  });

  it("records automatic evidence only inside the declared production boundary", async () => {
    vi.stubEnv("DECISION_WORKSPACE_ENVIRONMENT", "production");
    vi.stubEnv("DECISION_WORKSPACE_ACCEPTANCE_ENVIRONMENT", "production");
    vi.stubEnv(
      "DECISION_WORKSPACE_ACCEPTANCE_PATH",
      path.join(
        os.tmpdir(),
        `decision-workspace-automatic-${process.pid}-${Date.now()}.json`,
      ),
    );

    const result = await recordAutomaticDecisionWorkspaceAcceptanceEvidence({
      requirementId: "T3.3.2",
      measuredAt: "2026-07-29T00:00:00.000Z",
      acceptanceMet: true,
      summary: "Provider-backed element detection completed.",
      runId: "elements-run-123",
      requestOrigin: "https://workspace.example.test",
    });

    expect(result).toMatchObject({
      recorded: true,
      evidence: { environment: "production", method: "automatic" },
    });
  });

  it("rejects automatic evidence from a non-production runtime", async () => {
    vi.stubEnv("DECISION_WORKSPACE_ENVIRONMENT", "local");
    vi.stubEnv("DECISION_WORKSPACE_ACCEPTANCE_ENVIRONMENT", "production");

    await expect(
      recordAutomaticDecisionWorkspaceAcceptanceEvidence({
        requirementId: "T3.3.4",
        measuredAt: "2026-07-29T00:00:00.000Z",
        acceptanceMet: true,
        summary: "Local audio inference completed.",
        runId: "audio-run-local",
        requestOrigin: "http://localhost:3000",
      }),
    ).resolves.toEqual({ recorded: false, reason: "non_production" });
  });
});
