const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

export function normalizeVerdictText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Build the short headline shown on the overview verdict button.
 *
 * The generated Verdict is written as a full paragraph, which is too long to
 * scan at a glance. Prefer the first complete sentence and only fall back to a
 * clipped string when that sentence is still too long to fit.
 */
export function conciseVerdict(value: string, maxLength = 96) {
  const normalized = normalizeVerdictText(value);
  if (!normalized) return "";

  const [firstSentence = ""] = normalized.split(SENTENCE_BOUNDARY);
  const headline = firstSentence.trim() || normalized;
  if (headline.length <= maxLength) return headline.replace(/[.]$/, "");

  const clipped = headline.slice(0, maxLength - 1).replace(/\s+\S*$/, "");
  return `${clipped || headline.slice(0, maxLength - 1)}…`;
}
