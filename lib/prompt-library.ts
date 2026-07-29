export type PromptUseCase = "copy_generation" | "creative_brief" | "performance_narration" | "anomaly_detection" | "forecasting";

export type PromptVersion = {
  id: string;
  useCase: PromptUseCase;
  version: number;
  template: string;
  variables: string[];
  changelog: string;
  createdAt: string;
  active: boolean;
};

export type PromptLibrary = Record<PromptUseCase, PromptVersion[]>;

export const AI_CHARTER: Array<{ useCase: PromptUseCase; purpose: string; allowedInputs: string[]; prohibited: string[]; output: string }> = [
  { useCase: "copy_generation", purpose: "Create editable ad-copy options from an approved offer and audience brief.", allowedInputs: ["brand voice", "offer", "audience", "proof points"], prohibited: ["invented claims", "unverified pricing", "copied competitor copy"], output: "labeled copy variants" },
  { useCase: "creative_brief", purpose: "Turn accepted evidence and owned performance into an original test brief.", allowedInputs: ["accepted evidence", "creative gaps", "brand guardrails"], prohibited: ["plagiarism", "unverified competitor conclusions"], output: "hypothesis-led creative brief" },
  { useCase: "performance_narration", purpose: "Explain canonical metrics and diagnostic evidence in client-ready language.", allowedInputs: ["owned performance rows", "quality gates", "decision rules"], prohibited: ["invented revenue", "public intelligence presented as owned data"], output: "evidence-backed narration" },
  { useCase: "anomaly_detection", purpose: "Prioritize material delivery and measurement deviations.", allowedInputs: ["time series", "baselines", "quality gates"], prohibited: ["automatic destructive actions", "unsupported causal claims"], output: "ranked anomaly with evidence" },
  { useCase: "forecasting", purpose: "Describe bounded scenarios using declared assumptions.", allowedInputs: ["response curves", "constraints", "historical volatility"], prohibited: ["guaranteed outcomes", "hidden assumptions"], output: "scenario range and assumptions" },
];

export function createPromptLibrary(seed: Partial<PromptLibrary> = {}): PromptLibrary {
  return {
    copy_generation: seed.copy_generation || [],
    creative_brief: seed.creative_brief || [],
    performance_narration: seed.performance_narration || [],
    anomaly_detection: seed.anomaly_detection || [],
    forecasting: seed.forecasting || [],
  };
}

export function addPromptVersion(library: PromptLibrary, input: Omit<PromptVersion, "version" | "createdAt" | "active"> & { version?: number; active?: boolean }) {
  const versions = library[input.useCase] || [];
  const nextVersion = input.version || Math.max(0, ...versions.map((item) => item.version)) + 1;
  const next: PromptVersion = { ...input, version: nextVersion, createdAt: new Date().toISOString(), active: input.active ?? true };
  const nextVersions = versions.map((item) => ({ ...item, active: next.active ? false : item.active }));
  return { ...library, [input.useCase]: [...nextVersions, next].sort((left, right) => right.version - left.version) };
}

export function activePrompt(library: PromptLibrary, useCase: PromptUseCase) {
  return library[useCase].find((prompt) => prompt.active) || library[useCase][0];
}

export function renderPrompt(prompt: PromptVersion, values: Record<string, string | number>) {
  return prompt.template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu, (match, key: string) => values[key] === undefined ? match : String(values[key]));
}

export function promptDiff(previous: PromptVersion, next: PromptVersion) {
  const previousLines = previous.template.split("\n");
  const nextLines = next.template.split("\n");
  return {
    added: nextLines.filter((line) => !previousLines.includes(line)),
    removed: previousLines.filter((line) => !nextLines.includes(line)),
  };
}

export type PromptTest = {
  id: string;
  useCase: PromptUseCase;
  controlPromptId: string;
  treatmentPromptId: string;
  metric: "acceptance_rate" | "edit_distance" | "task_success";
  assignments: Record<string, "control" | "treatment">;
  results: Array<{ unitId: string; variant: "control" | "treatment"; value: number }>;
};

const promptTests: PromptTest[] = [];

function hash(value: string) {
  let output = 0;
  for (let index = 0; index < value.length; index += 1) output = (output * 31 + value.charCodeAt(index)) >>> 0;
  return output;
}

export function createPromptTest(input: Omit<PromptTest, "assignments" | "results">) {
  const test: PromptTest = { ...input, assignments: {}, results: [] };
  promptTests.unshift(test);
  return test;
}

export function assignPromptTest(id: string, unitId: string) {
  const test = promptTests.find((item) => item.id === id);
  if (!test) throw new Error("Prompt test not found.");
  const variant = hash(`${id}:${unitId}`) % 2 === 0 ? "control" : "treatment";
  test.assignments[unitId] = variant;
  return { variant, promptId: variant === "control" ? test.controlPromptId : test.treatmentPromptId };
}

export function recordPromptTestResult(id: string, unitId: string, value: number) {
  const test = promptTests.find((item) => item.id === id);
  if (!test) throw new Error("Prompt test not found.");
  const variant = test.assignments[unitId];
  if (!variant) throw new Error("Assign the unit before recording its result.");
  test.results = [...test.results.filter((item) => item.unitId !== unitId), { unitId, variant, value }];
  return summarizePromptTest(test);
}

export function summarizePromptTest(test: PromptTest) {
  const average = (variant: "control" | "treatment") => {
    const values = test.results.filter((item) => item.variant === variant).map((item) => item.value);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  };
  const control = average("control");
  const treatment = average("treatment");
  const lowerIsBetter = test.metric === "edit_distance";
  const lift = control !== 0
    ? (lowerIsBetter ? control - treatment : treatment - control) / Math.abs(control)
    : 0;
  const winner = control === treatment
    ? "tie" as const
    : lowerIsBetter
      ? treatment < control ? "treatment" as const : "control" as const
      : treatment > control ? "treatment" as const : "control" as const;
  return { test, control, treatment, lift, winner };
}

export function listPromptTests() {
  return promptTests.map(summarizePromptTest);
}
