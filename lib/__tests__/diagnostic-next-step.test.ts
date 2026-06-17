import { describe, expect, it } from "vitest";
import { diagnosticNextStep, type DiagnosticKind, type DiagnosticTone } from "../diagnostic-next-step";

const KINDS: DiagnosticKind[] = [
  "healthTriage",
  "dailyDiagnosis",
  "experimentReadiness",
  "decisionConfidence",
  "creativeVolume",
  "budgetMove",
  "funnelLeakage",
  "audienceOverlap",
  "targetingExclusions",
  "creativeStarvation",
  "breakdownWaste",
  "resultConcentration",
  "spendPacing",
  "consolidationPressure",
  "costCapDelivery",
  "measurementQuality",
];

const TONES: DiagnosticTone[] = ["critical", "warning", "ok", "insufficient"];

describe("diagnosticNextStep", () => {
  it("returns a non-empty bilingual next step for every kind and tone", () => {
    for (const kind of KINDS) {
      for (const tone of TONES) {
        const en = diagnosticNextStep(kind, tone, "en");
        const vi = diagnosticNextStep(kind, tone, "vi");
        expect(en.trim().length, `${kind}/${tone}/en`).toBeGreaterThan(0);
        expect(vi.trim().length, `${kind}/${tone}/vi`).toBeGreaterThan(0);
      }
    }
  });

  it("gives a distinct action for critical vs ok tone", () => {
    const critical = diagnosticNextStep("funnelLeakage", "critical", "en");
    const ok = diagnosticNextStep("funnelLeakage", "ok", "en");
    expect(critical).not.toBe(ok);
  });

  it("frames the insufficient tone around collecting more data", () => {
    const en = diagnosticNextStep("audienceOverlap", "insufficient", "en");
    expect(en.toLowerCase()).toMatch(/data|wait|more/);
  });
});
