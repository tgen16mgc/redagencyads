import type { CompetitorEvidenceStatus } from "@/lib/types";

export type CompetitorEvidenceRow = {
  id: string;
  text: string;
  advertiser?: string;
  status: Extract<CompetitorEvidenceStatus, "accepted" | "needs_review">;
  source: "manual_ad_library_note";
};

export type CompetitorEvidenceReadiness = {
  canAnalyze: boolean;
  primaryIsCollect: boolean;
  dockStatus: "idle" | "ready" | "working" | "blocked";
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

function hasUnambiguousName(value: string) {
  return Array.from(value.replace(/\s+/g, "")).length >= 2;
}

function startsWithAdvertiserPrefix(text: string, advertiser: string) {
  if (!hasUnambiguousName(advertiser)) return false;

  if (text.startsWith(`[${advertiser}]`)) {
    return text.slice(advertiser.length + 2).trim().length > 0;
  }

  if (!text.startsWith(advertiser)) return false;
  const remainder = text.slice(advertiser.length);
  return /^\s*[-–—:|]\s*\S/u.test(remainder);
}

export function reviewCompetitorEvidence(notes: string, competitors: string[]): CompetitorEvidenceRow[] {
  const names = competitors
    .map((name) => ({ name: name.trim(), normalized: normalized(name) }))
    .filter((item) => item.normalized.length > 0);

  return notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => {
      const normalizedText = normalized(text);
      const match = names.find((item) => startsWithAdvertiserPrefix(normalizedText, item.normalized));
      return {
        id: `manual-evidence-${index + 1}`,
        text,
        advertiser: match?.name,
        status: match ? "accepted" : "needs_review",
        source: "manual_ad_library_note" as const,
      };
    });
}

export function acceptedManualEvidenceText(notes: string, competitors: string[]) {
  return reviewCompetitorEvidence(notes, competitors)
    .filter((row) => row.status === "accepted")
    .map((row) => row.text)
    .join("\n");
}

export function competitorEvidenceReadiness(input: {
  hasCompetitors: boolean;
  acceptedCount: number;
  acceptedManualCount: number;
  collectedCount: number;
  setupRequired: boolean;
  collecting: boolean;
  analyzing: boolean;
}): CompetitorEvidenceReadiness {
  const working = input.collecting || input.analyzing;
  const canAnalyze = input.hasCompetitors && input.acceptedCount > 0 && !working;
  const primaryIsCollect = input.collectedCount === 0 && input.acceptedManualCount === 0;
  const dockStatus = working
    ? "working"
    : canAnalyze
      ? "ready"
      : input.setupRequired || !input.hasCompetitors || (input.acceptedCount === 0 && input.collectedCount > 0)
        ? "blocked"
        : primaryIsCollect
          ? "ready"
          : "idle";

  return { canAnalyze, primaryIsCollect, dockStatus };
}
