#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
const json = args.has("--json");
const requireComplete = args.has("--require-complete");
const showPassed = args.has("--show-passed");
const baseUrl = (
  process.env.DECISION_WORKSPACE_URL || "http://localhost:3000"
).replace(/\/$/u, "");

let response;
try {
  response = await fetch(`${baseUrl}/api/readiness`, {
    headers: process.env.DECISION_WORKSPACE_COOKIE
      ? { cookie: process.env.DECISION_WORKSPACE_COOKIE }
      : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
} catch (error) {
  console.error(
    `Decision Workspace readiness is unreachable at ${baseUrl}: ${error instanceof Error ? error.message : "request failed"}`,
  );
  process.exit(1);
}

const payload = await response.json().catch(() => ({}));
if (!response.ok || !payload.readiness) {
  console.error(
    payload.error ||
      `Decision Workspace readiness failed with HTTP ${response.status}.`,
  );
  process.exit(1);
}

const readiness = payload.readiness;
if (json) {
  console.log(JSON.stringify(readiness, null, 2));
} else {
  console.log(
    `Decision Workspace: ${readiness.passedCount}/${readiness.totalGates} external gates passed`,
  );
  console.log(
    `Environment: ${readiness.environment}${readiness.productionEnvironment ? " (production)" : ""}`,
  );
  console.log(
    `Blocked: ${readiness.blockedCount} · Awaiting evidence: ${readiness.awaitingEvidenceCount} · Failed: ${readiness.failedCount}`,
  );
  for (const gate of readiness.gates) {
    if (gate.acceptanceMet && !showPassed) continue;
    console.log(`- ${gate.id} [${gate.state}] ${gate.title}`);
    console.log(`  ${gate.summary}`);
    if (gate.missingConfiguration?.length) {
      console.log(`  Missing: ${gate.missingConfiguration.join("; ")}`);
    }
  }
}

if (requireComplete && !readiness.complete) process.exitCode = 2;
