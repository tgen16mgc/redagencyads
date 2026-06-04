export type DashboardWorkflowStep = "connect" | "select" | "analyze" | "verdict";
export type DashboardWorkflowState = "complete" | "current" | "pending";

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
