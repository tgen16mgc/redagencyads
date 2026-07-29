#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const requirePass = removeFlag(args, "--require-pass");
const record = removeFlag(args, "--record");
const cohortLabel = removeOption(args, "--cohort");

const [command = "status", inputPath] = args;
const baseUrl = (
  process.env.DECISION_WORKSPACE_URL || "http://localhost:3000"
).replace(/\/$/u, "");
const commands = {
  status: { method: "GET", path: "/api/tiktok/acceptance" },
  coverage: { method: "POST", path: "/api/tiktok/coverage" },
  ingestion: { method: "POST", path: "/api/tiktok/ads" },
  deduplication: {
    method: "POST",
    path: "/api/tiktok/deduplication/validate",
  },
  search: { method: "POST", path: "/api/tiktok/ads/search" },
  scoring: { method: "POST", path: "/api/tiktok/scoring/validate" },
};
const selected = commands[command];

if (!selected) {
  console.error(
    `Unknown command "${command}". Use status, coverage, ingestion, deduplication, search, or scoring.`,
  );
  process.exit(1);
}
if (selected.method === "POST" && !inputPath) {
  console.error(`${command} requires a JSON input file.`);
  process.exit(1);
}
if (record && selected.method !== "POST") {
  console.error("--record is only valid for measurement commands.");
  process.exit(1);
}
const acceptanceToken = process.env.TIKTOK_ACCEPTANCE_TOKEN?.trim();
if (record && !acceptanceToken) {
  console.error("--record requires TIKTOK_ACCEPTANCE_TOKEN.");
  process.exit(1);
}

const headers =
  selected.method === "POST" ? { "content-type": "application/json" } : {};
if (record && acceptanceToken) {
  headers.authorization = `Bearer ${acceptanceToken}`;
  if (cohortLabel) headers["x-acceptance-cohort"] = cohortLabel;
}

const response = await fetch(`${baseUrl}${selected.path}`, {
  method: selected.method,
  headers,
  body:
    selected.method === "POST"
      ? await readFile(inputPath, "utf8")
      : undefined,
});
const payload = await response.json().catch(() => ({}));
console.log(JSON.stringify(payload, null, 2));

if (!response.ok) process.exit(1);
if (record && payload.evidenceRecording?.recorded !== true) process.exit(3);
if (requirePass && !acceptanceMet(command, payload)) process.exit(2);

function removeFlag(values, flag) {
  const index = values.indexOf(flag);
  if (index === -1) return false;
  values.splice(index, 1);
  return true;
}

function removeOption(values, option) {
  const index = values.indexOf(option);
  if (index === -1) return undefined;
  const value = values[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${option} requires a value.`);
    process.exit(1);
  }
  values.splice(index, 2);
  return value;
}

function acceptanceMet(name, payload) {
  if (name === "status") {
    return (
      payload.acceptance?.passedCount === payload.acceptance?.totalGates &&
      payload.acceptance?.totalGates > 0
    );
  }
  if (name === "coverage") return payload.coverage?.acceptanceMet === true;
  if (name === "ingestion") {
    return payload.report?.acceptance?.normalizedWithin15Minutes === true;
  }
  if (name === "search") return payload.acceptanceMet === true;
  return payload.validation?.acceptanceMet === true;
}
