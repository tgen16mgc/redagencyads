import type {
  CompetitorEvidenceProvenance,
  CompetitorEvidenceStatus,
  CompetitorFetchResult,
  CompetitorSpyAd,
} from "@/lib/types";

export type CompetitorEvidenceRow = {
  id: string;
  text: string;
  advertiser?: string;
  sourceUrl?: string;
  status: Extract<CompetitorEvidenceStatus, "accepted" | "needs_review">;
  source: "manual_ad_library_note";
};

export type CompetitorInputField = "names" | "market" | "platform" | "notes" | "libraryUrls";

export type CompetitorEvidenceWorkflowStage = "setup" | "collect" | "review" | "recover" | "analyze";

export type CompetitorEvidenceCoverageRow = {
  competitor: string;
  collected: number;
  accepted: number;
  needsReview: number;
};

export type CompetitorEvidenceModel = {
  manualRows: CompetitorEvidenceRow[];
  analyzableAds: CompetitorSpyAd[];
  analyzableCount: number;
  acceptedCount: number;
  reviewCount: number;
  matchedCount: number;
  totalRecordCount: number;
  zeroMatchCollection: boolean;
  evidenceSourceCount: number;
  coverage: CompetitorEvidenceCoverageRow[];
  canAnalyze: boolean;
  workflowStage: CompetitorEvidenceWorkflowStage;
  dockStatus: "idle" | "ready" | "working" | "blocked";
};

function normalizedName(value: string | undefined) {
  return value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") || "";
}

function hasUnambiguousName(value: string) {
  return Array.from(value.replace(/\s+/g, "")).length >= 2;
}

function isNameBoundary(char: string | undefined) {
  return char === undefined || !/[\p{L}\p{N}]/u.test(char);
}

function containsWholeName(container: string, contained: string) {
  let index = container.indexOf(contained);
  while (index >= 0) {
    if (isNameBoundary(container[index - 1]) && isNameBoundary(container[index + contained.length])) return true;
    index = container.indexOf(contained, index + 1);
  }
  return false;
}

export function matchAdvertiserName(
  advertiser: string | undefined,
  competitor: string | undefined,
): "exact" | "similar" | "none" {
  const advertiserKey = normalizedName(advertiser);
  const competitorKey = normalizedName(competitor);
  if (!advertiserKey || !competitorKey) return "none";
  if (advertiserKey === competitorKey) return "exact";
  if (hasUnambiguousName(competitorKey) && containsWholeName(advertiserKey, competitorKey)) return "similar";
  if (hasUnambiguousName(advertiserKey) && containsWholeName(competitorKey, advertiserKey)) return "similar";
  return "none";
}

export function trustedMetaLibraryUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim().replace(/[.!?;:,]+$/u, ""));
    const host = url.hostname.toLocaleLowerCase();
    const isFacebookHost = host === "facebook.com" || host.endsWith(".facebook.com");
    const isLibraryPath = url.pathname === "/ads/library" || url.pathname === "/ads/library/";
    return url.protocol === "https:" && isFacebookHost && isLibraryPath ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function canVerifyCompetitorEvidence(evidence: CompetitorEvidenceProvenance | undefined) {
  return Boolean(evidence?.matchedToCompetitor && trustedMetaLibraryUrl(evidence.sourceUrl));
}

export function competitorInputChangeEffects(field: CompetitorInputField) {
  return {
    invalidatesBrief: true,
    clearsCollectedEvidence: field === "names" || field === "libraryUrls",
  };
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

function metaLibrarySourceUrl(text: string) {
  const candidates = text.match(/https:\/\/[^\s)\]}>,]+/giu) || [];
  for (const candidate of candidates) {
    const url = trustedMetaLibraryUrl(candidate);
    if (url) return url;
  }
  return undefined;
}

function reviewManualEvidence(notes: string, competitors: string[]): CompetitorEvidenceRow[] {
  const names = competitors
    .map((name) => ({ name: name.trim(), normalized: normalizedName(name) }))
    .filter((item) => item.normalized.length > 0);

  return notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => {
      const normalizedText = normalizedName(text);
      const match = names.find((item) => startsWithAdvertiserPrefix(normalizedText, item.normalized));
      const sourceUrl = metaLibrarySourceUrl(text);
      return {
        id: `manual-evidence-${index + 1}`,
        text,
        advertiser: match?.name,
        sourceUrl,
        status: match && sourceUrl ? "accepted" : "needs_review",
        source: "manual_ad_library_note" as const,
      };
    });
}

export function deriveCompetitorEvidenceModel(input: {
  competitors: string[];
  notes: string;
  evidence: CompetitorFetchResult | null;
  collectionAvailable: boolean;
  collecting: boolean;
  analyzing: boolean;
}): CompetitorEvidenceModel {
  const manualRows = reviewManualEvidence(input.notes, input.competitors);
  const acceptedManual = manualRows.filter((row) => row.status === "accepted");
  const reviewManual = manualRows.filter((row) => row.status === "needs_review");
  const matchedManual = manualRows.filter((row) => Boolean(row.advertiser));
  const collectedAds = input.evidence?.ads || [];
  const acceptedAds = collectedAds.filter((ad) => ad.evidence?.status === "accepted");
  const reviewAds = collectedAds.filter((ad) => ad.evidence?.status === "needs_review");
  const matchedAds = collectedAds.filter((ad) => ad.evidence?.matchedToCompetitor);
  const analyzableAds = acceptedAds.filter((ad) => ad.evidence?.matchedToCompetitor && ad.evidence.hasUsableCreative);
  const analyzableCount = analyzableAds.length + acceptedManual.length;
  const reviewCount = reviewAds.length + reviewManual.length;
  const zeroMatchCollection = Boolean(input.evidence && collectedAds.length > 0 && matchedAds.length === 0);
  const coverage = input.competitors.map((competitor) => {
    const rows = collectedAds.filter(
      (ad) => normalizedName(ad.evidence?.requestedCompetitor) === normalizedName(competitor),
    );
    const manual = manualRows.filter((row) => normalizedName(row.advertiser) === normalizedName(competitor));
    return {
      competitor,
      collected: rows.length + manual.length,
      accepted: rows.filter((ad) => ad.evidence?.status === "accepted").length
        + manual.filter((row) => row.status === "accepted").length,
      needsReview: rows.filter((ad) => ad.evidence?.status === "needs_review").length
        + manual.filter((row) => row.status === "needs_review").length,
    };
  });

  const hasCompetitors = input.competitors.length > 0;
  const working = input.collecting || input.analyzing;
  const canAnalyze = hasCompetitors && analyzableCount > 0 && !working;
  const workflowStage: CompetitorEvidenceWorkflowStage = !hasCompetitors
    ? "setup"
    : input.collecting
      ? "collect"
      : input.analyzing
        ? "analyze"
        : zeroMatchCollection
          ? "recover"
          : canAnalyze
            ? "analyze"
            : reviewCount > 0
              ? "review"
              : "collect";
  const primaryIsCollect = collectedAds.length === 0 && acceptedManual.length === 0;
  const dockStatus = workflowStage === "setup" || workflowStage === "review" || workflowStage === "recover"
    ? "ready" as const
    : working
      ? "working" as const
      : canAnalyze
        ? "ready" as const
        : !input.collectionAvailable || (analyzableCount === 0 && collectedAds.length > 0)
          ? "blocked" as const
          : primaryIsCollect
            ? "ready" as const
            : "idle" as const;

  return {
    manualRows,
    analyzableAds,
    analyzableCount,
    acceptedCount: acceptedAds.length + acceptedManual.length,
    reviewCount,
    matchedCount: matchedAds.length + matchedManual.length,
    totalRecordCount: collectedAds.length + manualRows.length,
    zeroMatchCollection,
    evidenceSourceCount: Number(Boolean(input.evidence)) + Number(manualRows.length > 0),
    coverage,
    canAnalyze,
    workflowStage,
    dockStatus,
  };
}
