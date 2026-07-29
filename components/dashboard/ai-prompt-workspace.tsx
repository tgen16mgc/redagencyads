"use client";

import * as React from "react";
import { BookOpenCheckIcon, GitBranchIcon, SparklesIcon } from "lucide-react";
import { AI_CHARTER, type PromptLibrary, type PromptTest, type PromptUseCase, type PromptVersion } from "@/lib/prompt-library";
import { jsonFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type CharterItem = (typeof AI_CHARTER)[number];
type PromptTestSummary = { test: PromptTest; control: number; treatment: number; lift: number; winner: "control" | "treatment" | "tie" };

const useCases: PromptUseCase[] = ["copy_generation", "creative_brief", "performance_narration", "anomaly_detection", "forecasting"];

export function AiPromptWorkspace({ language }: { language: "en" | "vi" }) {
  const isVietnamese = language === "vi";
  const [charter, setCharter] = React.useState<CharterItem[]>([]);
  const [library, setLibrary] = React.useState<PromptLibrary | null>(null);
  const [tests, setTests] = React.useState<PromptTestSummary[]>([]);
  const [useCase, setUseCase] = React.useState<PromptUseCase>("copy_generation");
  const [template, setTemplate] = React.useState("");
  const [variables, setVariables] = React.useState("");
  const [changelog, setChangelog] = React.useState("");
  const [testId, setTestId] = React.useState("prompt-test-1");
  const [testMetric, setTestMetric] = React.useState<"acceptance_rate" | "edit_distance" | "task_success">("task_success");
  const [controlPromptId, setControlPromptId] = React.useState("");
  const [treatmentPromptId, setTreatmentPromptId] = React.useState("");
  const [assignmentUnitId, setAssignmentUnitId] = React.useState("");
  const [assignment, setAssignment] = React.useState<{ variant: "control" | "treatment"; promptId: string } | null>(null);
  const [resultValue, setResultValue] = React.useState("");
  const [testMessage, setTestMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    const [promptData, testData] = await Promise.all([
      jsonFetch<{ charter: CharterItem[]; library: PromptLibrary }>("/api/ai/prompts", { timeoutMs: 8000 }),
      jsonFetch<{ tests: PromptTestSummary[] }>("/api/ai/prompts/test", { timeoutMs: 8000 }),
    ]);
    setCharter(promptData.charter); setLibrary(promptData.library); setTests(testData.tests);
    const active = promptData.library[useCase]?.find((prompt) => prompt.active) || promptData.library[useCase]?.[0];
    if (active) { setTemplate(active.template); setVariables(active.variables.join(", ")); }
  }, [useCase]);

  React.useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load AI prompt workspace.")); }, [load]);

  const selectedCharter = charter.find((item) => item.useCase === useCase);
  const versions = library?.[useCase] || [];

  React.useEffect(() => {
    const oldest = versions.at(-1)?.id || "";
    const newest = versions[0]?.id || "";
    setControlPromptId((current) => versions.some((version) => version.id === current) ? current : oldest);
    setTreatmentPromptId((current) => versions.some((version) => version.id === current) ? current : newest);
  }, [library, useCase]);

  async function saveVersion() {
    setError("");
    try {
      await jsonFetch("/api/ai/prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: `${useCase}-v${versions.length + 1}`, useCase, template, variables: variables.split(",").map((item) => item.trim()).filter(Boolean), changelog, active: true }), timeoutMs: 8000 });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save prompt version."); }
  }

  async function createTest() {
    setTestMessage("");
    try {
      if (!testId.trim()) throw new Error("Test ID is required.");
      if (!controlPromptId || !treatmentPromptId) throw new Error("Save two prompt versions before creating an A/B test.");
      if (controlPromptId === treatmentPromptId) throw new Error("Control and treatment must use different prompt versions.");
      await jsonFetch("/api/ai/prompts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "create", id: testId.trim(), useCase, controlPromptId, treatmentPromptId, metric: testMetric }), timeoutMs: 8000 });
      setTestMessage(`Created ${testId.trim()} · ${controlPromptId} vs ${treatmentPromptId}`);
      await load();
    } catch (reason) { setTestMessage(reason instanceof Error ? reason.message : "Unable to create prompt test."); }
  }

  async function assignTestUnit() {
    setTestMessage("");
    try {
      if (!testId.trim() || !assignmentUnitId.trim()) throw new Error("Enter a test ID and assignment unit ID.");
      const data = await jsonFetch<{ result: { variant: "control" | "treatment"; promptId: string } }>("/api/ai/prompts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "assign", id: testId.trim(), unitId: assignmentUnitId.trim() }), timeoutMs: 8000 });
      setAssignment(data.result);
      setTestMessage(`${assignmentUnitId.trim()} → ${data.result.variant} · ${data.result.promptId}`);
    } catch (reason) { setTestMessage(reason instanceof Error ? reason.message : "Unable to assign prompt test unit."); }
  }

  async function recordResult() {
    try {
      const value = Number(resultValue);
      const unitId = assignmentUnitId.trim();
      if (!testId.trim() || !unitId || !Number.isFinite(value)) throw new Error("Enter an assigned unit ID and numeric result value first.");
      const data = await jsonFetch<{ result: PromptTestSummary }>("/api/ai/prompts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "result", id: testId.trim(), unitId, value }), timeoutMs: 8000 });
      const variant = data.result.test.assignments[unitId];
      setTestMessage(`${unitId} ${variant} result recorded · winner: ${data.result.winner}`);
      await load();
    } catch (reason) { setTestMessage(reason instanceof Error ? reason.message : "Unable to record prompt result."); }
  }

  return <div className="grid gap-4">
    <Card><CardHeader><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl border bg-background"><SparklesIcon className="size-4" /></span><div><CardTitle>{isVietnamese ? "AI charter" : "AI charter"}</CardTitle><CardDescription>Five bounded use cases with allowed inputs, prohibited claims, and expected outputs.</CardDescription></div></div></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{charter.map((item) => <button key={item.useCase} type="button" onClick={() => setUseCase(item.useCase)} className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${item.useCase === useCase ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}><p className="text-sm font-semibold">{item.useCase.replaceAll("_", " ")}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.purpose}</p><div className="mt-3 flex flex-wrap gap-1">{item.prohibited.slice(0, 2).map((entry) => <Badge key={entry} variant="outline" className="h-auto max-w-full whitespace-normal py-1 text-left leading-4">No {entry}</Badge>)}</div></button>)}</CardContent></Card>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]"><Card><CardHeader><div className="flex items-center gap-3"><BookOpenCheckIcon className="size-4" /><div><CardTitle>Prompt versioning</CardTitle><CardDescription>{selectedCharter?.output || "Version-controlled prompt template"}</CardDescription></div></div></CardHeader><CardContent className="grid gap-4"><FieldGroup><Field><FieldLabel>Use case</FieldLabel><select value={useCase} onChange={(event) => setUseCase(event.target.value as PromptUseCase)} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground">{useCases.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></Field><Field><FieldLabel>Template</FieldLabel><textarea value={template} onChange={(event) => setTemplate(event.target.value)} rows={7} placeholder="Use {{variable}} placeholders." className="rounded-lg border bg-background p-3 text-sm text-foreground" /></Field><div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel>Variables</FieldLabel><Input value={variables} onChange={(event) => setVariables(event.target.value)} placeholder="audience, offer, guardrails" /></Field><Field><FieldLabel>Changelog</FieldLabel><Input value={changelog} onChange={(event) => setChangelog(event.target.value)} placeholder="What changed?" /></Field></div></FieldGroup><Button type="button" onClick={() => void saveVersion()}>Save active version</Button>{error ? <p className="text-sm text-destructive">{error}</p> : null}</CardContent></Card><Card><CardHeader><CardTitle>Version history</CardTitle><CardDescription>Active prompt is explicit; older versions remain available for A/B tests.</CardDescription></CardHeader><CardContent>{versions.length ? <div className="divide-y rounded-xl border">{versions.map((version: PromptVersion) => <div key={version.id} className="p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">v{version.version} · {version.id}</span>{version.active ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Archived</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{version.changelog || "No changelog"}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No versions yet. Save the first prompt for this use case.</p>}</CardContent></Card></div>

    <Card><CardHeader><div className="flex items-center gap-3"><GitBranchIcon className="size-4" /><div><CardTitle>Prompt A/B test</CardTitle><CardDescription>Deterministic assignment and task-success result logging.</CardDescription></div></div></CardHeader><CardContent className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Field><FieldLabel>Test ID</FieldLabel><Input value={testId} onChange={(event) => setTestId(event.target.value)} /></Field><Field><FieldLabel>Metric</FieldLabel><select value={testMetric} onChange={(event) => setTestMetric(event.target.value as typeof testMetric)} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"><option value="task_success">Task success</option><option value="acceptance_rate">Acceptance rate</option><option value="edit_distance">Edit distance</option></select></Field><Field><FieldLabel>Control prompt</FieldLabel><select value={controlPromptId} onChange={(event) => setControlPromptId(event.target.value)} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground" disabled={!versions.length}>{versions.map((version) => <option key={version.id} value={version.id}>{version.id}</option>)}</select></Field><Field><FieldLabel>Treatment prompt</FieldLabel><select value={treatmentPromptId} onChange={(event) => setTreatmentPromptId(event.target.value)} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground" disabled={!versions.length}>{versions.map((version) => <option key={version.id} value={version.id}>{version.id}</option>)}</select></Field></div><Button type="button" className="w-fit" onClick={() => void createTest()}>Create test</Button><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><Field><FieldLabel>Assignment unit ID</FieldLabel><Input value={assignmentUnitId} onChange={(event) => { setAssignmentUnitId(event.target.value); setAssignment(null); }} placeholder="user, device, or workspace ID" /></Field><Button type="button" variant="outline" className="self-end" onClick={() => void assignTestUnit()}>Assign unit</Button></div>{assignment ? <p className="text-xs text-muted-foreground">Assigned {assignmentUnitId} → <strong>{assignment.variant}</strong> · {assignment.promptId}</p> : null}<div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr]"><Field><FieldLabel>Observed result value</FieldLabel><Input type="number" step="any" value={resultValue} onChange={(event) => setResultValue(event.target.value)} placeholder="0 or 1" /></Field><div className="flex flex-wrap items-end gap-2"><Button type="button" variant="outline" onClick={() => void recordResult()}>Record assigned result</Button></div></div>{testMessage ? <p className="text-sm text-muted-foreground">{testMessage}</p> : null}{tests.length ? <div className="grid gap-2 md:grid-cols-2">{tests.map((item) => <div key={item.test.id} className="rounded-xl border p-3 text-sm"><div className="flex items-center justify-between gap-2"><span>{item.test.id}</span><Badge variant="secondary">{item.winner}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{item.test.useCase} · lift {(item.lift * 100).toFixed(1)}%</p></div>)}</div> : null}</CardContent></Card>
  </div>;
}
