#!/usr/bin/env node

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name) => args.includes(name);

if (has("--help")) {
  console.log(`Usage:
  npm run record:decision-workspace-evidence -- \\
    --requirement T2.1.2 \\
    --summary "Airflow run completed inside the SLA" \\
    --run-id airflow-run-123

Environment:
  DECISION_WORKSPACE_URL                 App origin; defaults to http://localhost:3000
  DECISION_WORKSPACE_ACCEPTANCE_TOKEN    Operator token configured by the app

Options:
  --requirement <id>     External requirement ID
  --summary <text>       Human-readable production result
  --run-id <id>          Traceable deployment or provider run ID
  --evidence-url <url>   Traceable evidence URL
  --measured-at <iso>    Measurement time; defaults to now
  --failed               Record that the acceptance criterion failed`);
  process.exit(0);
}

const requirementId = value("--requirement");
const summary = value("--summary");
const runId = value("--run-id");
const evidenceUrl = value("--evidence-url");
const measuredAt = value("--measured-at") || new Date().toISOString();
const token = process.env.DECISION_WORKSPACE_ACCEPTANCE_TOKEN?.trim();
const baseUrl = (
  process.env.DECISION_WORKSPACE_URL || "http://localhost:3000"
).replace(/\/$/u, "");

if (!requirementId || !summary || (!runId && !evidenceUrl)) {
  console.error(
    "--requirement, --summary, and either --run-id or --evidence-url are required. Use --help for an example.",
  );
  process.exit(1);
}
if (!token) {
  console.error("DECISION_WORKSPACE_ACCEPTANCE_TOKEN is required.");
  process.exit(1);
}

let response;
try {
  response = await fetch(`${baseUrl}/api/readiness`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requirementId,
      measuredAt,
      acceptanceMet: !has("--failed"),
      summary,
      runId,
      evidenceUrl,
    }),
    signal: AbortSignal.timeout(30_000),
  });
} catch (error) {
  console.error(
    `Decision Workspace readiness is unreachable at ${baseUrl}: ${error instanceof Error ? error.message : "request failed"}`,
  );
  process.exit(1);
}

const payload = await response.json().catch(() => ({}));
if (!response.ok || !payload.recording?.recorded) {
  console.error(
    payload.error ||
      `Evidence recording failed (${response.status}): ${payload.recording?.reason || "unknown error"}.`,
  );
  process.exit(1);
}

console.log(
  `${requirementId} evidence recorded. Decision Workspace: ${payload.readiness.passedCount}/${payload.readiness.totalGates} external gates passed.`,
);
