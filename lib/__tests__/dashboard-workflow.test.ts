import { describe, expect, it } from "vitest";
import { buildWorkflowSteps } from "../dashboard-workflow";

describe("buildWorkflowSteps", () => {
  it("marks Select as current before a report is loaded", () => {
    expect(buildWorkflowSteps({ hasAccount: true, hasReport: false, hasVerdict: false })).toEqual([
      { value: "connect", state: "complete" },
      { value: "select", state: "current" },
      { value: "analyze", state: "pending" },
      { value: "verdict", state: "pending" },
    ]);
  });

  it("marks Analyze as current after a report is loaded but before a Verdict exists", () => {
    expect(buildWorkflowSteps({ hasAccount: true, hasReport: true, hasVerdict: false })).toEqual([
      { value: "connect", state: "complete" },
      { value: "select", state: "complete" },
      { value: "analyze", state: "current" },
      { value: "verdict", state: "pending" },
    ]);
  });

  it("marks Verdict as complete after the Verdict exists", () => {
    expect(buildWorkflowSteps({ hasAccount: true, hasReport: true, hasVerdict: true })).toEqual([
      { value: "connect", state: "complete" },
      { value: "select", state: "complete" },
      { value: "analyze", state: "complete" },
      { value: "verdict", state: "complete" },
    ]);
  });
});
