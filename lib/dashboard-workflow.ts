export type DashboardWorkflowStep = "connect" | "select" | "analyze" | "verdict";
export type DashboardWorkflowState = "complete" | "current" | "pending";

export type DashboardWorkflowDestination =
  | { kind: "connect" }
  | { kind: "scope" }
  | { kind: "performance"; target: "overview" | "actions" };

type WorkflowInput = {
  hasAccount: boolean;
  hasReport: boolean;
  hasVerdict: boolean;
};

export function buildWorkflowSteps(input: WorkflowInput): { value: DashboardWorkflowStep; state: DashboardWorkflowState }[] {
  const selectState = input.hasReport ? "complete" : input.hasAccount ? "current" : "pending";
  const analyzeState = input.hasReport ? (input.hasVerdict ? "complete" : "current") : "pending";

  return [
    { value: "connect", state: "complete" },
    { value: "select", state: selectState },
    { value: "analyze", state: analyzeState },
    { value: "verdict", state: input.hasVerdict ? "complete" : "pending" },
  ];
}

export function dashboardWorkflowDestination(step: DashboardWorkflowStep): DashboardWorkflowDestination {
  if (step === "connect") return { kind: "connect" };
  if (step === "select") return { kind: "scope" };
  return { kind: "performance", target: step === "verdict" ? "actions" : "overview" };
}
