export type CompetitorEvidenceRow = {
  id: string;
  text: string;
  advertiser?: string;
  status: "advertiser_linked" | "needs_review";
  source: "manual_ad_library_note";
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
        status: match ? "advertiser_linked" : "needs_review",
        source: "manual_ad_library_note" as const,
      };
    });
}

export function advertiserLinkedEvidenceText(notes: string, competitors: string[]) {
  return reviewCompetitorEvidence(notes, competitors)
    .filter((row) => row.status === "advertiser_linked")
    .map((row) => row.text)
    .join("\n");
}
