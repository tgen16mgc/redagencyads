import { describe, expect, it } from "vitest";
import { diagnosticNextStep } from "../diagnostic-next-step";
import type { DiagnosticId, DiagnosticSeverity } from "../diagnosis";

const IDS: DiagnosticId[] = [
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

const SEVERITIES: DiagnosticSeverity[] = ["risk", "watch", "ok", "insufficient"];

describe("diagnosticNextStep", () => {
  it("returns a non-empty bilingual next step for every id and severity", () => {
    for (const id of IDS) {
      for (const severity of SEVERITIES) {
        const en = diagnosticNextStep(id, severity, "en");
        const vi = diagnosticNextStep(id, severity, "vi");
        expect(en.trim().length, `${id}/${severity}/en`).toBeGreaterThan(0);
        expect(vi.trim().length, `${id}/${severity}/vi`).toBeGreaterThan(0);
      }
    }
  });

  it("gives a distinct action for risk vs ok severity", () => {
    const risk = diagnosticNextStep("funnelLeakage", "risk", "en");
    const ok = diagnosticNextStep("funnelLeakage", "ok", "en");
    expect(risk).not.toBe(ok);
  });

  it("frames the insufficient severity around collecting more data", () => {
    const en = diagnosticNextStep("audienceOverlap", "insufficient", "en");
    expect(en.toLowerCase()).toMatch(/data|wait|more/);
  });
});
