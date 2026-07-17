"use client";

import * as React from "react";
import {
  CheckIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  ImageOffIcon,
  LayoutGridIcon,
  LinkIcon,
  ListIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react";

import { StickyActionDock } from "@/components/dashboard/sticky-action-dock";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CapabilityStatus } from "@/lib/capabilities";
import { competitorEvidenceReadiness, reviewCompetitorEvidence } from "@/lib/competitor-evidence";
import { normalizeCompetitorNames } from "@/lib/competitor-input";
import type {
  CompetitorEvidenceStatus,
  CompetitorFetchResult,
  CompetitorPlatform,
  CompetitorSpyAd,
  CompetitorSpyResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ReportLanguage = "en" | "vi";
type Provider = "auto" | "9router" | "prompt";
type EvidenceFilter = "all" | "matched" | CompetitorEvidenceStatus;
type LibraryView = "grid" | "list";
type MediaFilter = "all" | "video" | "image";

const platformItems: { label: string; value: CompetitorPlatform }[] = [
  { label: "Meta / Instagram", value: "meta" },
  { label: "Google", value: "google" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "TikTok", value: "tiktok" },
  { label: "Mixed", value: "mixed" },
];

const providerItems: { label: string; value: Provider }[] = [
  { label: "Auto: best available", value: "auto" },
  { label: "9router", value: "9router" },
  { label: "Local rules only", value: "prompt" },
];

const statusPriority: Record<CompetitorEvidenceStatus, number> = {
  accepted: 0,
  needs_review: 1,
  rejected: 2,
};

function normalized(value: string | undefined) {
  return value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") || "";
}

function safeHttpsUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safeEvidenceSourceUrl(value: string | undefined) {
  const normalizedUrl = safeHttpsUrl(value);
  if (!normalizedUrl) return undefined;
  const url = new URL(normalizedUrl);
  const host = url.hostname.toLocaleLowerCase();
  const isFacebookHost = host === "facebook.com" || host.endsWith(".facebook.com");
  const isLibraryPath = url.pathname === "/ads/library" || url.pathname === "/ads/library/";
  return isFacebookHost && isLibraryPath ? normalizedUrl : undefined;
}

function compactText(value: string | undefined, maxLength: number) {
  const text = value?.trim() || "";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
}

function formatTimestamp(value: string | undefined, language: ReportLanguage) {
  if (!value) return language === "vi" ? "Chưa thu thập" : "Not collected";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function sourceLabel(ad: CompetitorSpyAd) {
  if (ad.source === "apify") return "Apify · Meta Ad Library";
  if (ad.source === "meta_official") return "Meta Ad Library API";
  return "Meta Ad Library";
}

function platformLabel(platform: CompetitorPlatform) {
  return platformItems.find((item) => item.value === platform)?.label || platform;
}

function providerLabel(provider: Provider | CompetitorSpyResult["provider"], language: ReportLanguage) {
  if (provider === "9router") return "9router";
  if (provider === "prompt") return language === "vi" ? "Luật cục bộ" : "Local rules";
  return language === "vi" ? "Tự động" : "Auto";
}

function statusLabel(status: CompetitorEvidenceStatus, language: ReportLanguage) {
  if (status === "accepted") return language === "vi" ? "Đã xác minh" : "Verified";
  if (status === "rejected") return language === "vi" ? "Đã loại" : "Discarded";
  return language === "vi" ? "Cần duyệt" : "Needs review";
}

function statusVariant(status: CompetitorEvidenceStatus) {
  if (status === "accepted") return "success" as const;
  if (status === "rejected") return "outline" as const;
  return "secondary" as const;
}

function evidenceReasonLabel(ad: CompetitorSpyAd, language: ReportLanguage) {
  const reason = ad.evidence?.reason;
  if (reason === "exact_advertiser_trusted_source") {
    return language === "vi" ? "Khớp chính xác advertiser và có nguồn Meta tin cậy." : "Exact advertiser match with a trusted Meta source.";
  }
  if (reason === "exact_advertiser_missing_source") {
    return language === "vi" ? "Khớp advertiser nhưng thiếu nguồn Meta có thể xác minh." : "Advertiser matches, but a verifiable Meta source is missing.";
  }
  if (reason === "similar_advertiser") {
    return language === "vi" ? "Tên advertiser tương tự và cần bạn xác nhận." : "Advertiser name is similar and needs your confirmation.";
  }
  if (reason === "advertiser_unknown") {
    return language === "vi" ? "Không xác định được advertiser của ad này." : "The advertiser could not be identified.";
  }
  return language === "vi" ? "Advertiser không khớp đối thủ đã chọn." : "Advertiser does not match the selected competitor.";
}

function EvidenceMedia({
  ad,
  language,
  detail = false,
  onRefresh,
}: {
  ad: CompetitorSpyAd;
  language: ReportLanguage;
  detail?: boolean;
  onRefresh?: () => void;
}) {
  const [failed, setFailed] = React.useState(false);
  const videoUrl = safeHttpsUrl(ad.videoUrl);
  const imageUrl = safeHttpsUrl(ad.imageUrl);

  React.useEffect(() => setFailed(false), [imageUrl, videoUrl]);

  if (videoUrl && !failed) {
    return (
      <div className={cn("flex w-full items-center justify-center overflow-hidden bg-muted", detail ? "min-h-64 rounded-xl" : "aspect-[4/3]") }>
        <video
          src={videoUrl}
          poster={imageUrl}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          className={cn("size-full object-contain", detail && "max-h-[70vh]")}
          aria-label={language === "vi" ? `Video quảng cáo của ${ad.pageName || "đối thủ"}` : `Video ad from ${ad.pageName || "competitor"}`}
        />
      </div>
    );
  }

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={language === "vi" ? `Creative quảng cáo của ${ad.pageName || "đối thủ"}` : `Ad creative from ${ad.pageName || "competitor"}`}
        className={cn("w-full bg-muted object-contain", detail ? "max-h-[70vh] min-h-64 rounded-xl" : "aspect-[4/3]")}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={cn("flex w-full flex-col items-center justify-center gap-2 bg-muted px-4 text-center", detail ? "min-h-64 rounded-xl" : "aspect-[4/3]") }>
      <ImageOffIcon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">
        {failed
          ? language === "vi" ? "Media đã hết hạn hoặc không tải được." : "Media expired or could not be loaded."
          : language === "vi" ? "Không có preview media." : "No media preview returned."}
      </p>
      {failed && onRefresh ? (
        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCcwIcon data-icon="inline-start" />
          {language === "vi" ? "Làm mới media" : "Refresh media"}
        </Button>
      ) : null}
    </div>
  );
}

function InsightBlock({
  icon: Icon,
  label,
  title,
  detail,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  title: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 py-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-semibold leading-5 text-foreground">{title}</div>
        {detail ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function CompetitorEvidenceWorkspace({
  names,
  market,
  platform,
  libraryUrls,
  notes,
  evidence,
  result,
  collecting,
  analyzing,
  error,
  capabilityState,
  language,
  provider,
  copiedPrompt,
  onNamesChange,
  onMarketChange,
  onPlatformChange,
  onNotesChange,
  onLibraryUrlsChange,
  onProviderChange,
  onCollect,
  onEvidenceStatusChange,
  onGenerate,
  onCopyPrompt,
}: {
  names: string;
  market: string;
  platform: CompetitorPlatform;
  libraryUrls: string;
  notes: string;
  evidence: CompetitorFetchResult | null;
  result: CompetitorSpyResult | null;
  collecting: boolean;
  analyzing: boolean;
  error: string;
  capabilityState: CapabilityStatus["state"];
  language: ReportLanguage;
  provider: Provider;
  copiedPrompt: boolean;
  onNamesChange: (value: string) => void;
  onMarketChange: (value: string) => void;
  onPlatformChange: (value: CompetitorPlatform) => void;
  onNotesChange: (value: string) => void;
  onLibraryUrlsChange: (value: string) => void;
  onProviderChange: (value: Provider) => void;
  onCollect: () => void;
  onEvidenceStatusChange: (id: string, status: CompetitorEvidenceStatus) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
}) {
  const isVietnamese = language === "vi";
  const id = React.useId();
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<EvidenceFilter>("matched");
  const [libraryView, setLibraryView] = React.useState<LibraryView>("grid");
  const [mediaFilter, setMediaFilter] = React.useState<MediaFilter>("all");
  const [visibleAdLimit, setVisibleAdLimit] = React.useState(12);
  const [competitorFilter, setCompetitorFilter] = React.useState("all");
  const [focusPendingManualEvidence, setFocusPendingManualEvidence] = React.useState(false);
  const [focusLibraryUrls, setFocusLibraryUrls] = React.useState(false);
  const recordsSectionRef = React.useRef<HTMLElement>(null);
  const manualEvidenceRef = React.useRef<HTMLTextAreaElement>(null);
  const libraryUrlsRef = React.useRef<HTMLTextAreaElement>(null);

  const competitorNames = normalizeCompetitorNames(names);
  const hasCompetitors = competitorNames.length > 0;
  const manualEvidence = reviewCompetitorEvidence(notes, competitorNames);
  const acceptedManual = manualEvidence.filter((row) => row.status === "accepted");
  const reviewManual = manualEvidence.filter((row) => row.status === "needs_review");
  const matchedManual = manualEvidence.filter((row) => Boolean(row.advertiser));
  const firstPendingManualText = reviewManual[0]?.text;
  const collectedAds = evidence?.ads || [];
  const acceptedAds = collectedAds.filter((ad) => ad.evidence?.status === "accepted");
  const reviewAds = collectedAds.filter((ad) => ad.evidence?.status === "needs_review");
  const rejectedAds = collectedAds.filter((ad) => ad.evidence?.status === "rejected");
  const matchedAds = collectedAds.filter((ad) => ad.evidence?.matchedToCompetitor);
  const mediaReadyAds = collectedAds.filter((ad) => ad.evidence?.hasUsableCreative);
  const analyzableAds = acceptedAds.filter((ad) => ad.evidence?.matchedToCompetitor && ad.evidence.hasUsableCreative);
  const acceptedCount = acceptedAds.length + acceptedManual.length;
  const reviewCount = reviewAds.length + reviewManual.length;
  const matchedCount = matchedAds.length + matchedManual.length;
  const analyzableCount = analyzableAds.length + acceptedManual.length;
  const totalRecordCount = collectedAds.length + manualEvidence.length;
  const zeroMatchCollection = Boolean(evidence && collectedAds.length > 0 && matchedAds.length === 0);
  const collectionAvailable = capabilityState === "available";
  const selectedAd = collectedAds.find((ad) => ad.id === selectedEvidenceId && ad.evidence) || null;
  const selectedEvidenceSourceUrl = safeEvidenceSourceUrl(selectedAd?.evidence?.sourceUrl);
  const effectiveCompetitorFilter = competitorNames.some((name) => normalized(name) === normalized(competitorFilter))
    ? competitorFilter
    : "all";

  const orderedAds = collectedAds
    .filter((ad) => ad.evidence)
    .sort((left, right) => statusPriority[left.evidence!.status] - statusPriority[right.evidence!.status]);
  const filteredAds = orderedAds.filter((ad) => {
    const provenance = ad.evidence!;
    const statusMatches = statusFilter === "all"
      || (statusFilter === "matched" ? provenance.matchedToCompetitor : provenance.status === statusFilter);
    const competitorMatches = effectiveCompetitorFilter === "all"
      || normalized(provenance.requestedCompetitor) === normalized(effectiveCompetitorFilter);
    const mediaMatches = mediaFilter === "all"
      || (mediaFilter === "video" ? Boolean(safeHttpsUrl(ad.videoUrl)) : Boolean(safeHttpsUrl(ad.imageUrl)) && !safeHttpsUrl(ad.videoUrl));
    return statusMatches && competitorMatches && mediaMatches;
  });
  const visibleAds = filteredAds.slice(0, visibleAdLimit);
  const visibleManual = manualEvidence.filter((row) => {
    const statusMatches = statusFilter === "all"
      || (statusFilter === "matched" ? Boolean(row.advertiser) : row.status === statusFilter);
    const competitorMatches = effectiveCompetitorFilter === "all"
      || normalized(row.advertiser) === normalized(effectiveCompetitorFilter);
    return mediaFilter === "all" && statusMatches && competitorMatches;
  });
  const visibleRecordCount = filteredAds.length + visibleManual.length;
  const remainingAdCount = Math.max(0, filteredAds.length - visibleAds.length);
  const videoAdCount = collectedAds.filter((ad) => Boolean(safeHttpsUrl(ad.videoUrl))).length;
  const imageAdCount = collectedAds.filter((ad) => Boolean(safeHttpsUrl(ad.imageUrl)) && !safeHttpsUrl(ad.videoUrl)).length;

  const liveCoverage = competitorNames.map((competitor) => {
    const rows = collectedAds.filter(
      (ad) => normalized(ad.evidence?.requestedCompetitor) === normalized(competitor),
    );
    const manualRows = manualEvidence.filter((row) => normalized(row.advertiser) === normalized(competitor));
    return {
      competitor,
      collected: rows.length + manualRows.length,
      accepted: rows.filter((ad) => ad.evidence?.status === "accepted").length
        + manualRows.filter((row) => row.status === "accepted").length,
      needsReview: rows.filter((ad) => ad.evidence?.status === "needs_review").length
        + manualRows.filter((row) => row.status === "needs_review").length,
    };
  });
  const evidenceSourceCount = Number(Boolean(evidence)) + Number(manualEvidence.length > 0);
  const { canAnalyze, dockStatus } = competitorEvidenceReadiness({
    hasCompetitors,
    acceptedCount: analyzableCount,
    acceptedManualCount: acceptedManual.length,
    collectedCount: collectedAds.length,
    setupRequired: !collectionAvailable,
    collecting,
    analyzing,
  });
  const onboarding = !hasCompetitors && totalRecordCount === 0 && !result;
  const workflowStage = !hasCompetitors
    ? "setup"
    : collecting
      ? "collect"
      : analyzing
        ? "analyze"
        : zeroMatchCollection
          ? "recover"
        : canAnalyze
          ? "analyze"
          : reviewCount > 0
            ? "review"
            : "collect";
  const effectiveDockStatus = workflowStage === "setup" || workflowStage === "review" || workflowStage === "recover" ? "ready" : dockStatus;
  const evidenceReferences = new Map<string, { label: string; sourceUrl?: string; kind: "ad" | "manual" }>();
  collectedAds.forEach((ad) => {
    if (!ad.evidence) return;
    evidenceReferences.set(ad.id, {
      label: ad.evidence.advertiser || ad.evidence.requestedCompetitor,
      sourceUrl: safeEvidenceSourceUrl(ad.evidence.sourceUrl),
      kind: "ad",
    });
  });
  manualEvidence.forEach((row) => {
    evidenceReferences.set(row.id, {
      label: row.advertiser || (isVietnamese ? "Note thủ công" : "Manual note"),
      sourceUrl: safeEvidenceSourceUrl(row.sourceUrl),
      kind: "manual",
    });
  });
  const dockStatusLabel = collecting
    ? isVietnamese ? "Đang thu thập · thường 30–90 giây" : "Collecting · usually 30–90 sec"
    : analyzing
      ? isVietnamese ? "Đang phân tích" : "Analyzing evidence"
      : canAnalyze
        ? isVietnamese ? "Đã xác minh · sẵn sàng" : "Verified · ready"
        : zeroMatchCollection
          ? isVietnamese ? `0 khớp · ${collectedAds.length} đã thu thập` : `0 matched · ${collectedAds.length} collected`
        : !hasCompetitors
          ? isVietnamese ? "Sẵn sàng thiết lập" : "Ready to set up"
          : !collectionAvailable && acceptedManual.length === 0
            ? isVietnamese ? "Apify cần cấu hình hoặc thêm note" : "Apify needs setup or add a note"
            : reviewCount > 0
              ? isVietnamese ? "Cần duyệt" : "Review needed"
              : isVietnamese ? "Cần evidence đã xác minh" : "Verified evidence needed";

  React.useEffect(() => {
    if (!setupOpen || !focusPendingManualEvidence || !firstPendingManualText) return;
    const frame = window.requestAnimationFrame(() => {
      const textarea = manualEvidenceRef.current;
      if (!textarea) return;
      const start = notes.indexOf(firstPendingManualText);
      textarea.focus();
      if (start >= 0) textarea.setSelectionRange(start, start + firstPendingManualText.length);
      textarea.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusPendingManualEvidence(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [firstPendingManualText, focusPendingManualEvidence, notes, setupOpen]);

  React.useEffect(() => {
    if (!setupOpen || !focusLibraryUrls) return;
    const frame = window.requestAnimationFrame(() => {
      libraryUrlsRef.current?.focus();
      libraryUrlsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusLibraryUrls(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusLibraryUrls, setupOpen]);

  React.useEffect(() => {
    setVisibleAdLimit(12);
  }, [competitorFilter, mediaFilter, statusFilter]);

  function applyStatusFilter(value: string[]) {
    const next = value[0] as EvidenceFilter | undefined;
    if (next) setStatusFilter(next);
  }

  function applyCompetitorFilter(value: string[]) {
    const next = value[0];
    if (next) setCompetitorFilter(next);
  }

  function reviewEvidence() {
    setStatusFilter("needs_review");
    setCompetitorFilter("all");
    const firstReviewAd = reviewAds[0];
    if (firstReviewAd) {
      setSelectedEvidenceId(firstReviewAd.id);
      return;
    }
    if (reviewManual.length > 0) {
      setFocusPendingManualEvidence(true);
      setSetupOpen(true);
      return;
    }
    recordsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addExactLibraryUrl() {
    setFocusLibraryUrls(true);
    setSetupOpen(true);
  }

  function browseCollectedAds() {
    setStatusFilter("all");
    recordsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEvidenceReference(evidenceId: string) {
    const reference = evidenceReferences.get(evidenceId);
    if (!reference) return;
    if (reference.kind === "ad") {
      setSelectedEvidenceId(evidenceId);
    }
  }

  function startCollection() {
    setSetupOpen(false);
    onCollect();
  }

  return (
    <div className="relative pb-[var(--action-dock-clearance)]" data-print-flow>
      <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby={`${id}-workspace-title`}>
        <header className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`${id}-workspace-title`} className="font-heading text-xl font-semibold tracking-tight">
                {isVietnamese ? "Thư viện quảng cáo đối thủ" : "Competitor ad library"}
              </h2>
              <Badge variant={matchedCount > 0 ? "success" : "outline"}>
                {matchedCount}/{totalRecordCount} {isVietnamese ? "khớp" : "matched"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isVietnamese
                ? "Xem creative ngay trong tool, xác minh advertiser và biến evidence đáng tin cậy thành brief."
                : "Browse creatives in the tool, verify advertisers, and turn trustworthy evidence into a brief."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {evidenceSourceCount > 0 ? (
              <Badge variant="outline">
                {isVietnamese
                  ? `${evidenceSourceCount} nguồn evidence`
                  : `${evidenceSourceCount} evidence source${evidenceSourceCount === 1 ? "" : "s"}`}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                {isVietnamese ? "Đang chờ lần thu thập đầu tiên" : "Awaiting first collection"}
              </span>
            )}
            {evidence?.fetchedAt ? (
              <span className="text-xs text-muted-foreground">
                {isVietnamese ? "Thu thập lần cuối" : "Last collected"} {formatTimestamp(evidence.fetchedAt, language)}
              </span>
            ) : manualEvidence.length > 0 ? (
              <span className="text-xs text-muted-foreground">{isVietnamese ? "Evidence thủ công đã sẵn sàng" : "Manual evidence ready"}</span>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setSetupOpen(true)}>
              <SlidersHorizontalIcon data-icon="inline-start" />
              {isVietnamese ? "Nguồn & đối thủ" : "Sources & competitors"}
            </Button>
          </div>
        </header>

        {error ? (
          <div className="px-4 pb-4 md:px-5">
            <Alert variant="destructive">
              <AlertTitle>{isVietnamese ? "Không thể hoàn thành" : "Action failed"}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        {!onboarding ? (
          <div className="grid grid-cols-2 gap-px border-t bg-border md:grid-cols-5" aria-label={isVietnamese ? "Tóm tắt lần thu thập" : "Collection summary"}>
            {[
              { label: isVietnamese ? "Đã thu thập" : "Collected", value: collectedAds.length },
              { label: isVietnamese ? "Khớp" : "Matched", value: matchedAds.length },
              { label: isVietnamese ? "Có media" : "Media ready", value: mediaReadyAds.length },
              { label: isVietnamese ? "Đã xác minh" : "Verified", value: acceptedAds.length },
              { label: isVietnamese ? "Đã loại" : "Discarded", value: rejectedAds.length },
            ].map((metric, index) => (
              <div key={metric.label} className={cn("bg-card px-4 py-3", index === 4 && "col-span-2 md:col-span-1")}>
                <div className="font-mono text-lg font-semibold tabular-nums">{metric.value}</div>
                <div className="text-xs text-muted-foreground">{metric.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        <Separator />

        <div className={cn("grid xl:min-h-[660px]", onboarding ? "xl:grid-cols-1" : "xl:grid-cols-[240px_minmax(420px,1fr)_340px]")}>
          <aside className={cn("hidden border-r p-4 xl:block", onboarding && "xl:hidden")} aria-label={isVietnamese ? "Bộ lọc evidence" : "Evidence filters"}>
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{isVietnamese ? "Hộp thư evidence" : "Evidence inbox"}</h3>
                  <Badge variant="outline">{totalRecordCount}</Badge>
                </div>
                <ToggleGroup
                  value={[statusFilter]}
                  onValueChange={applyStatusFilter}
                  variant="outline"
                  size="sm"
                  spacing={1}
                  className="mt-3 flex-wrap justify-start"
                  aria-label={isVietnamese ? "Lọc theo trạng thái" : "Filter by status"}
                >
                  <ToggleGroupItem value="all" className="min-h-11">{isVietnamese ? "Tất cả ads" : "All ads"} {totalRecordCount}</ToggleGroupItem>
                  <ToggleGroupItem value="matched" className="min-h-11">{isVietnamese ? "Khớp" : "Matched"} {matchedCount}</ToggleGroupItem>
                  <ToggleGroupItem value="accepted" className="min-h-11">{isVietnamese ? "Đã xác minh" : "Verified"} {acceptedCount}</ToggleGroupItem>
                  <ToggleGroupItem value="needs_review" className="min-h-11">{isVietnamese ? "Cần duyệt" : "Review"} {reviewCount}</ToggleGroupItem>
                  <ToggleGroupItem value="rejected" className="min-h-11">{isVietnamese ? "Đã loại" : "Discarded"} {rejectedAds.length}</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div>
                <h3 className="text-xs font-medium text-muted-foreground">{isVietnamese ? "Nguồn" : "Sources"}</h3>
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">Apify · Meta Ads</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {collectionAvailable ? (isVietnamese ? "Sẵn sàng thu thập" : "Ready to collect") : (isVietnamese ? "Cần cấu hình" : "Needs setup")}
                      </div>
                    </div>
                    <Badge variant={collectionAvailable ? "success" : "outline"}>{collectedAds.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{isVietnamese ? "Ghi chú thủ công" : "Manual notes"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {acceptedManual.length} {isVietnamese ? "dòng có nguồn" : "source-linked lines"}
                      </div>
                    </div>
                    <Badge variant={acceptedManual.length > 0 ? "success" : "outline"}>{manualEvidence.length}</Badge>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-muted-foreground">{isVietnamese ? "Đối thủ" : "Competitors"}</h3>
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setSetupOpen(true)}>
                    {isVietnamese ? "Chỉnh sửa" : "Edit"}
                  </Button>
                </div>
                {competitorNames.length > 0 ? (
                  <ToggleGroup
                    value={[effectiveCompetitorFilter]}
                    onValueChange={applyCompetitorFilter}
                    variant="outline"
                    size="sm"
                    spacing={1}
                    orientation="vertical"
                    className="mt-2 w-full"
                    aria-label={isVietnamese ? "Lọc theo đối thủ" : "Filter by competitor"}
                  >
                    <ToggleGroupItem value="all" className="min-h-11 w-full justify-between">
                      <span>{isVietnamese ? "Tất cả đối thủ" : "All competitors"}</span>
                      <span className="tabular-nums">{totalRecordCount}</span>
                    </ToggleGroupItem>
                    {liveCoverage.map((coverage) => (
                      <ToggleGroupItem key={coverage.competitor} value={coverage.competitor} className="min-h-11 w-full justify-between">
                        <span className="truncate">{coverage.competitor}</span>
                        <span className="tabular-nums">{coverage.collected}</span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isVietnamese ? "Thêm đối thủ để bắt đầu." : "Add competitors to begin."}
                  </p>
                )}
              </div>
            </div>
          </aside>

          <section
            ref={recordsSectionRef}
            className={cn("min-w-0 border-b p-4 xl:border-r xl:border-b-0", onboarding && "xl:border-r-0")}
            aria-labelledby={`${id}-records-title`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 id={`${id}-records-title`} className="text-base font-semibold">
                  {isVietnamese ? "Ads trong thư viện" : "Ads in your library"} · {visibleRecordCount}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isVietnamese
                    ? "Xem image, video và Reel trực tiếp; mở chi tiết để duyệt provenance."
                    : "Play images, videos, and Reels here; open details to review provenance."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{platformLabel(platform)}</Badge>
                <ToggleGroup
                  value={[libraryView]}
                  onValueChange={(value) => {
                    const next = value[0] as LibraryView | undefined;
                    if (next) setLibraryView(next);
                  }}
                  variant="outline"
                  size="sm"
                  spacing={1}
                  aria-label={isVietnamese ? "Kiểu hiển thị thư viện" : "Library view"}
                >
                  <ToggleGroupItem value="grid" aria-label={isVietnamese ? "Dạng lưới" : "Grid view"}>
                    <LayoutGridIcon />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label={isVietnamese ? "Dạng danh sách" : "List view"}>
                    <ListIcon />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {!onboarding && totalRecordCount > 0 ? (
              <ToggleGroup
                value={[statusFilter]}
                onValueChange={applyStatusFilter}
                variant="outline"
                size="sm"
                spacing={1}
                className="mt-4 flex-wrap justify-start xl:hidden"
                aria-label={isVietnamese ? "Lọc theo trạng thái" : "Filter by status"}
              >
                <ToggleGroupItem value="all" className="min-h-11">{isVietnamese ? "Tất cả ads" : "All ads"} {totalRecordCount}</ToggleGroupItem>
                <ToggleGroupItem value="matched" className="min-h-11">{isVietnamese ? "Khớp" : "Matched"} {matchedCount}</ToggleGroupItem>
                <ToggleGroupItem value="accepted" className="min-h-11">{isVietnamese ? "Đã xác minh" : "Verified"} {acceptedCount}</ToggleGroupItem>
                <ToggleGroupItem value="needs_review" className="min-h-11">{isVietnamese ? "Cần duyệt" : "Review"} {reviewCount}</ToggleGroupItem>
                <ToggleGroupItem value="rejected" className="min-h-11">{isVietnamese ? "Đã loại" : "Discarded"} {rejectedAds.length}</ToggleGroupItem>
              </ToggleGroup>
            ) : null}

            {collectedAds.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{isVietnamese ? "Loại creative" : "Creative type"}</span>
                <ToggleGroup
                  value={[mediaFilter]}
                  onValueChange={(value) => {
                    const next = value[0] as MediaFilter | undefined;
                    if (next) setMediaFilter(next);
                  }}
                  variant="outline"
                  size="sm"
                  spacing={1}
                  aria-label={isVietnamese ? "Lọc theo loại creative" : "Filter by creative type"}
                >
                  <ToggleGroupItem value="all">{isVietnamese ? "Tất cả" : "All"} {collectedAds.length}</ToggleGroupItem>
                  <ToggleGroupItem value="video">{isVietnamese ? "Video / Reel" : "Video / Reels"} {videoAdCount}</ToggleGroupItem>
                  <ToggleGroupItem value="image">{isVietnamese ? "Ảnh" : "Images"} {imageAdCount}</ToggleGroupItem>
                </ToggleGroup>
              </div>
            ) : null}

            {collecting ? (
              <Alert className="mt-4" aria-live="polite">
                <Spinner data-icon="inline-start" />
                <AlertTitle>{isVietnamese ? "Đang thu thập evidence" : "Collecting evidence"}</AlertTitle>
                <AlertDescription>
                  {isVietnamese
                    ? "Apify đang lấy dữ liệu công khai từ Meta Ad Library. Thường mất 30–90 giây; bạn có thể tiếp tục làm việc."
                    : "Apify is pulling public Meta Ad Library records. This usually takes 30–90 seconds; you can keep working."}
                </AlertDescription>
              </Alert>
            ) : null}

            {zeroMatchCollection ? (
              <Alert className="mt-4">
                <AlertTitle>
                  {isVietnamese
                    ? `0 ads khớp từ ${collectedAds.length} ads đã thu thập`
                    : `0 matched ads from ${collectedAds.length} collected`}
                </AlertTitle>
                <AlertDescription>
                  <p>
                    {isVietnamese
                      ? "Các creative vẫn có trong thư viện, nhưng advertiser không khớp đối thủ đã chọn. Thêm URL page chính xác để thử lại với độ chính xác cao hơn."
                      : "The creatives are still available in the library, but their advertisers do not match the selected competitor. Add the exact advertiser page URL for a precise retry."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={addExactLibraryUrl}>
                      <LinkIcon data-icon="inline-start" />
                      {isVietnamese ? "Thêm URL Ad Library chính xác" : "Add exact Ad Library URL"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={browseCollectedAds}>
                      <LayoutGridIcon data-icon="inline-start" />
                      {isVietnamese ? `Xem ${collectedAds.length} ads đã thu thập` : `Browse ${collectedAds.length} collected ads`}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {evidence?.warnings.length && !zeroMatchCollection ? (
              <Alert className="mt-4">
                <AlertTitle>{isVietnamese ? "Cảnh báo thu thập" : "Collection warning"}</AlertTitle>
                <AlertDescription>{evidence.warnings.join(" ")}</AlertDescription>
              </Alert>
            ) : null}

            {visibleRecordCount > 0 ? (
              <div className={cn(
                "workbench-fade-up mt-4 grid gap-3",
                libraryView === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
              )}>
                {visibleManual.map((row) => {
                  const sourceUrl = safeEvidenceSourceUrl(row.sourceUrl);
                  return (
                    <article key={row.id} className="col-span-full rounded-xl border bg-background/45 p-3" data-evidence-id={row.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{row.advertiser || (isVietnamese ? "Note cần gắn đối thủ" : "Note needs a competitor")}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{isVietnamese ? "Evidence thủ công" : "Manual evidence"} · {row.id}</div>
                        </div>
                        <Badge variant={statusVariant(row.status)}>{statusLabel(row.status, language)}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{compactText(row.text, 480)}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        {sourceUrl ? (
                          <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
                            {isVietnamese ? "Mở nguồn Meta Ad Library" : "Open Meta Ad Library source"}
                            <ExternalLinkIcon aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">{isVietnamese ? "Thêm URL nguồn để xác minh" : "Add a source URL to verify"}</span>
                        )}
                        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setSetupOpen(true)}>
                          <SlidersHorizontalIcon data-icon="inline-start" />
                          {isVietnamese ? "Chỉnh sửa note" : "Edit note"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
                {visibleAds.map((ad) => {
                  const provenance = ad.evidence!;
                  return (
                    <article key={ad.id} className="overflow-hidden rounded-xl border bg-background/45" data-evidence-id={ad.id}>
                      <div className={cn(libraryView === "list" && "grid sm:grid-cols-[220px_minmax(0,1fr)]")}>
                        <EvidenceMedia ad={ad} language={language} onRefresh={onCollect} />
                        <div className="flex min-w-0 flex-col p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{provenance.advertiser || (isVietnamese ? "Advertiser chưa rõ" : "Unknown advertiser")}</div>
                              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                {isVietnamese ? "Đối thủ yêu cầu:" : "Requested:"} {provenance.requestedCompetitor}
                              </div>
                            </div>
                            <Badge variant={statusVariant(provenance.status)}>{statusLabel(provenance.status, language)}</Badge>
                          </div>
                          <div className="mt-3">
                            {ad.headline ? <div className="line-clamp-1 text-sm font-medium">{ad.headline}</div> : null}
                            <p className="mt-1 line-clamp-3 text-sm leading-5 text-muted-foreground" data-print-expand>
                              {ad.body || ad.description || (isVietnamese ? "Không có nội dung creative." : "No creative copy returned.")}
                            </p>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-muted-foreground">
                            {evidenceReasonLabel(ad, language)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {ad.videoUrl ? <Badge variant="outline"><VideoIcon />{ad.format || "Video"}</Badge> : ad.format ? <Badge variant="outline">{ad.format}</Badge> : null}
                            {ad.isActive === true ? <Badge variant="success">{isVietnamese ? "Đang chạy" : "Currently running"}</Badge> : null}
                            {ad.isActive === false ? <Badge variant="outline">{isVietnamese ? "Đã kết thúc" : "Ended"}</Badge> : null}
                            {ad.cta ? <Badge variant="secondary">CTA · {ad.cta}</Badge> : null}
                          </div>
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                            <span className="text-xs text-muted-foreground">{formatTimestamp(provenance.collectedAt, language)}</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedEvidenceId(ad.id)}>
                              <ShieldCheckIcon data-icon="inline-start" />
                              {provenance.status === "needs_review"
                                ? isVietnamese ? "Duyệt ad" : "Review ad"
                                : isVietnamese ? "Xem chi tiết" : "View ad"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {remainingAdCount > 0 ? (
                  <div className="col-span-full flex justify-center pt-2">
                    <Button type="button" variant="outline" onClick={() => setVisibleAdLimit((current) => current + 12)}>
                      <PlusIcon data-icon="inline-start" />
                      {isVietnamese ? `Tải thêm ${Math.min(12, remainingAdCount)} ads` : `Load ${Math.min(12, remainingAdCount)} more ads`}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Empty className="mt-4 min-h-52 border md:min-h-64 xl:min-h-80">
                <EmptyHeader>
                  <EmptyMedia variant="icon">{onboarding ? <PlusIcon /> : <SearchIcon />}</EmptyMedia>
                  <EmptyTitle>
                    {zeroMatchCollection && statusFilter === "matched"
                      ? isVietnamese ? "Chưa có ads khớp đối thủ" : "No competitor matches yet"
                      : totalRecordCount > 0
                      ? isVietnamese ? "Không có record khớp bộ lọc" : "No records match these filters"
                      : onboarding
                        ? isVietnamese ? "Thêm đối thủ đầu tiên" : "Add your first competitors"
                        : isVietnamese ? "Sẵn sàng thu thập evidence" : "Ready to collect evidence"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {zeroMatchCollection && statusFilter === "matched"
                      ? isVietnamese ? "Thêm URL page chính xác để thu thập đúng advertiser, hoặc xem các creative đã trả về." : "Add the exact advertiser page URL for a precise collection, or browse the creatives already returned."
                      : totalRecordCount > 0
                      ? isVietnamese ? "Đổi trạng thái hoặc đối thủ để xem evidence khác." : "Change the status or competitor filter to see other evidence."
                      : onboarding
                        ? isVietnamese ? "Thêm tên hoặc URL Meta Ad Library để tạo một inbox evidence có thể kiểm tra." : "Add names or Meta Ad Library URLs to create an auditable evidence inbox."
                        : isVietnamese ? "Kiểm tra nguồn và bắt đầu lần thu thập đầu tiên." : "Review the sources and start the first collection."}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  {zeroMatchCollection && statusFilter === "matched" ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" onClick={addExactLibraryUrl}>
                        <LinkIcon data-icon="inline-start" />
                        {isVietnamese ? "Thêm URL chính xác" : "Add exact URL"}
                      </Button>
                      <Button type="button" variant="outline" onClick={browseCollectedAds}>
                        <LayoutGridIcon data-icon="inline-start" />
                        {isVietnamese ? "Xem tất cả ads" : "Browse all ads"}
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" onClick={() => setSetupOpen(true)}>
                      {onboarding ? <PlusIcon data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
                      {onboarding
                        ? isVietnamese ? "Thêm đối thủ" : "Add competitors"
                        : isVietnamese ? "Mở thiết lập nguồn" : "Open source setup"}
                    </Button>
                  )}
                </EmptyContent>
              </Empty>
            )}
          </section>

          <aside className={cn("p-4", onboarding && "hidden")} aria-labelledby={`${id}-brief-title`}>
            <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
              <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`${id}-brief-title`} className="text-base font-semibold">{isVietnamese ? "Decision brief" : "Decision brief"}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isVietnamese ? "Chỉ dựa trên evidence đã xác minh." : "Built only from verified evidence."}
                </p>
              </div>
              {result ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant="outline">{providerLabel(result.provider, language)}</Badge>
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onCopyPrompt} disabled={!canAnalyze}>
                    <ClipboardIcon data-icon="inline-start" />
                    {copiedPrompt ? (isVietnamese ? "Đã sao chép" : "Copied") : (isVietnamese ? "Sao chép prompt" : "Copy prompt")}
                  </Button>
                </div>
              ) : null}
              </div>

            {result ? (
              <div className="workbench-fade-up mt-4 flex flex-col gap-4">
                <div className="rounded-xl border bg-background/45 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <SparklesIcon className="size-4" aria-hidden="true" />
                    {isVietnamese ? "Thị trường đang nói gì" : "What the market is saying"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{compactText(result.summary, 360)}</p>
                </div>

                {result.themes.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground">{isVietnamese ? "Patterns & cơ hội" : "Patterns & opportunities"}</h4>
                    {result.themes.map((theme, index) => (
                      <React.Fragment key={`${theme.theme}-${index}`}>
                        <InsightBlock
                      icon={SearchIcon}
                          label={`${isVietnamese ? "Pattern" : "Pattern"} · ${theme.confidence}`}
                          title={theme.theme}
                          detail={compactText(theme.evidence, 260)}
                        >
                          <div className="mt-2 flex flex-wrap gap-2">
                            {theme.evidence_ids.length > 0 ? theme.evidence_ids.map((evidenceId) => {
                              const reference = evidenceReferences.get(evidenceId);
                              if (!reference) return null;
                              return reference.kind === "manual" && reference.sourceUrl ? (
                                <a key={evidenceId} href={reference.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-medium text-primary hover:bg-muted">
                                  <LinkIcon aria-hidden="true" />{reference.label}
                                </a>
                              ) : (
                                <Button key={evidenceId} type="button" variant="outline" size="xs" className="min-h-11" onClick={() => openEvidenceReference(evidenceId)}>
                                  <LinkIcon data-icon="inline-start" />{reference.label}
                                </Button>
                              );
                            }) : <Badge variant="outline">{isVietnamese ? "Giả thuyết" : "Hypothesis"}</Badge>}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-foreground">{theme.opportunity}</p>
                        </InsightBlock>
                        {index < result.themes.length - 1 ? <Separator /> : null}
                      </React.Fragment>
                    ))}
                  </div>
                ) : null}

                {result.competitors.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground">{isVietnamese ? "Đối thủ" : "Competitors"}</h4>
                    <div className="mt-2 flex flex-col gap-2">
                      {result.competitors.map((competitor) => (
                        <div key={competitor.name} className="rounded-xl border p-3">
                          <div className="text-sm font-semibold">{competitor.name}</div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{competitor.likely_positioning}</p>
                          <p className="mt-2 text-xs leading-5"><span className="font-medium">{isVietnamese ? "Gap:" : "Gap:"}</span> {competitor.gap}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {result.creative_gaps.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground">{isVietnamese ? "Creative gaps" : "Creative gaps"}</h4>
                    <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm leading-5 text-muted-foreground">
                      {result.creative_gaps.map((gap, index) => <li key={`${gap}-${index}`}>{gap}</li>)}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{isVietnamese ? "Evidence scope" : "Evidence scope"}</div>
                    <div className="mt-0.5 text-sm font-medium">{evidenceSourceCount} {isVietnamese ? "nguồn" : "sources"}</div>
                  </div>
                  <Badge variant="success">
                    {acceptedCount} {isVietnamese ? "record đã xác minh" : `verified record${acceptedCount === 1 ? "" : "s"}`}
                  </Badge>
                </div>

                {result.test_briefs.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground">{isVietnamese ? "Tests gợi ý" : "Recommended tests"}</h4>
                    <div className="mt-2 flex flex-col gap-2">
                      {result.test_briefs.map((test, index) => (
                        <div key={`${test.angle}-${index}`} className="rounded-xl border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold">{test.angle}</div>
                            <Badge variant="outline">{test.format}</Badge>
                          </div>
                          <p className="mt-2 text-sm leading-5 text-muted-foreground">{test.hook}</p>
                          <p className="mt-2 text-xs leading-5"><span className="font-medium">{isVietnamese ? "Vì sao:" : "Why:"}</span> {test.why}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground"><span className="font-medium text-foreground">{isVietnamese ? "Guardrail:" : "Guardrail:"}</span> {test.guardrail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {result.next_actions.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground">{isVietnamese ? "Hành động tiếp theo" : "Next actions"}</h4>
                    <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm leading-5">
                      {result.next_actions.map((action, index) => <li key={`${action}-${index}`}>{action}</li>)}
                    </ol>
                  </div>
                ) : null}

                {result.assumptions.length > 0 ? (
                  <Alert>
                    <AlertTitle>{isVietnamese ? "Giả định" : "Assumptions"}</AlertTitle>
                    <AlertDescription>{result.assumptions.join(" ")}</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : (
              <Empty className="mt-4 min-h-44 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><SparklesIcon /></EmptyMedia>
                  <EmptyTitle>{isVietnamese ? "Sẵn sàng tạo decision brief" : "Ready for a decision brief"}</EmptyTitle>
                  <EmptyDescription>
                    {acceptedCount > 0
                      ? isVietnamese ? "Phân tích evidence đã xác minh để tìm pattern, gap và test mới." : "Analyze verified evidence to find patterns, gaps, and original tests."
                      : isVietnamese ? "Xác minh ít nhất một record hoặc note có nguồn Meta trước." : "Verify at least one record or Meta-source-linked manual note first."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            </div>
          </aside>
        </div>
      </section>

      <Sheet open={setupOpen} onOpenChange={(open) => {
        setSetupOpen(open);
        if (!open) {
          setFocusPendingManualEvidence(false);
          setFocusLibraryUrls(false);
        }
      }}>
        <SheetContent className="overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{isVietnamese ? "Nguồn & đối thủ" : "Sources & competitors"}</SheetTitle>
            <SheetDescription>
              {isVietnamese
                ? "Cấu hình research brief, thu thập evidence và thêm note thủ công có advertiser rõ ràng."
                : "Configure the research brief, collect evidence, and add source-linked manual notes."}
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${id}-competitors`}>{isVietnamese ? "Đối thủ" : "Competitors"}</FieldLabel>
                <Textarea
                  id={`${id}-competitors`}
                  value={names}
                  onChange={(event) => onNamesChange(event.target.value)}
                  placeholder={isVietnamese ? "VD:\nSeoul Spa\nKangnam" : "Example:\nCompetitor A\nCompetitor B"}
                  className="min-h-24 resize-none"
                  aria-describedby={`${id}-competitors-help`}
                />
                <FieldDescription id={`${id}-competitors-help`}>
                  {isVietnamese ? "Nhập một đối thủ mỗi dòng hoặc ngăn cách bằng dấu phẩy." : "Enter one competitor per line or comma-separated."}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-library-urls`}>
                  {isVietnamese ? "URL Meta Ad Library" : "Meta Ad Library URLs"}
                  <Badge variant="secondary">{isVietnamese ? "Khuyến nghị" : "Recommended"}</Badge>
                </FieldLabel>
                <Textarea
                  ref={libraryUrlsRef}
                  id={`${id}-library-urls`}
                  value={libraryUrls}
                  onChange={(event) => onLibraryUrlsChange(event.target.value)}
                  placeholder="https://www.facebook.com/ads/library/?id=..."
                  className="min-h-24 resize-none"
                  aria-describedby={`${id}-library-urls-help`}
                />
                <FieldDescription id={`${id}-library-urls-help`}>
                  {isVietnamese
                    ? "Dán URL page từ Meta Ad Library để thu thập đúng advertiser. Mỗi dòng URL ghép với đối thủ cùng dòng ở trên."
                    : "Paste the advertiser page URL from Meta Ad Library for precise results. Each URL line maps to the competitor on the same line above."}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-market`}>{isVietnamese ? "Thị trường / offer" : "Market / offer"}</FieldLabel>
                <Input
                  id={`${id}-market`}
                  value={market}
                  onChange={(event) => onMarketChange(event.target.value)}
                  placeholder={isVietnamese ? "VD: trị nám HCM, tư vấn qua inbox" : "Example: acne clinic leads, free consult"}
                  className="min-h-11"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-notes`}>{isVietnamese ? "Evidence thủ công" : "Manual evidence"}</FieldLabel>
                <Textarea
                  ref={manualEvidenceRef}
                  id={`${id}-notes`}
                  value={notes}
                  onChange={(event) => onNotesChange(event.target.value)}
                  placeholder={isVietnamese ? "Kangnam - video before/after - https://www.facebook.com/ads/library/?id=..." : "Competitor A - UGC video - https://www.facebook.com/ads/library/?id=..."}
                  className="min-h-28 resize-none"
                  aria-describedby={`${id}-notes-help`}
                />
                <FieldDescription id={`${id}-notes-help`}>
                  {isVietnamese
                    ? "Mỗi dòng cần bắt đầu bằng đúng tên đối thủ và chứa URL Meta Ad Library. Dòng thiếu nguồn sẽ cần duyệt."
                    : "Start each line with the exact competitor name and include its Meta Ad Library URL. Missing-source lines need review."}
                </FieldDescription>
                {manualEvidence.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="success">{acceptedManual.length} {isVietnamese ? "đã xác minh" : "verified"}</Badge>
                    {reviewManual.length > 0 ? <Badge variant="secondary">{reviewManual.length} {isVietnamese ? "cần duyệt" : "need review"}</Badge> : null}
                  </div>
                ) : null}
              </Field>
              <Field>
                <FieldLabel id={`${id}-platform-label`}>{isVietnamese ? "Nền tảng" : "Platform"}</FieldLabel>
                <Select
                  items={platformItems}
                  value={platform}
                  onValueChange={(value) => {
                    if (value) onPlatformChange(value as CompetitorPlatform);
                  }}
                >
                  <SelectTrigger className="min-h-11 w-full" aria-labelledby={`${id}-platform-label`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {platformItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel id={`${id}-provider-label`}>{isVietnamese ? "Trình phân tích" : "Analysis provider"}</FieldLabel>
                <Select
                  items={providerItems}
                  value={provider}
                  onValueChange={(value) => {
                    if (value) onProviderChange(value as Provider);
                  }}
                >
                  <SelectTrigger className="min-h-11 w-full" aria-labelledby={`${id}-provider-label`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {providerItems.map((item) => <SelectItem key={item.value} value={item.value}>{providerLabel(item.value, language)}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <Alert className="mt-5">
              <AlertTitle>
                {collectionAvailable
                  ? isVietnamese ? "Apify sẵn sàng" : "Apify is ready"
                  : isVietnamese ? "Thu thập tự động chưa khả dụng" : "Automated collection unavailable"}
              </AlertTitle>
              <AlertDescription>
                {collectionAvailable
                  ? isVietnamese ? "Kết quả giữ requested competitor, observed advertiser và source để bạn duyệt." : "Results keep the requested competitor, observed advertiser, and source for review."
                  : isVietnamese ? "Bạn vẫn có thể phân tích note thủ công có URL Meta Ad Library hợp lệ." : "You can still analyze manual notes with a valid Meta Ad Library URL."}
              </AlertDescription>
            </Alert>
          </div>
          <SheetFooter className="border-t bg-popover pb-[max(1rem,env(safe-area-inset-bottom))]">
            {!hasCompetitors ? (
              <p className="text-xs text-muted-foreground">{isVietnamese ? "Thêm ít nhất một đối thủ để tiếp tục." : "Add at least one competitor to continue."}</p>
            ) : null}
            <Button type="button" className="min-h-11" onClick={startCollection} disabled={!collectionAvailable || !hasCompetitors || collecting || analyzing}>
              {collecting ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
              {collecting
                ? isVietnamese ? "Đang thu thập..." : "Collecting..."
                : evidence ? isVietnamese ? "Thu thập lại evidence" : "Refresh evidence"
                : isVietnamese ? "Thu thập evidence" : "Collect evidence"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selectedAd)} onOpenChange={(open) => {
        if (!open) setSelectedEvidenceId(null);
      }}>
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          {selectedAd?.evidence ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedAd.evidence.advertiser || selectedAd.headline || (isVietnamese ? "Chi tiết quảng cáo" : "Ad details")}</SheetTitle>
                <SheetDescription>
                  {evidenceReasonLabel(selectedAd, language)}
                </SheetDescription>
              </SheetHeader>
              <Separator />
              <div className="flex flex-col gap-5 px-4 pb-6">
                <EvidenceMedia ad={selectedAd} language={language} detail onRefresh={onCollect} />

                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant(selectedAd.evidence.status)}>{statusLabel(selectedAd.evidence.status, language)}</Badge>
                  {selectedAd.videoUrl ? <Badge variant="outline"><VideoIcon />{selectedAd.format || "Video / Reel"}</Badge> : selectedAd.format ? <Badge variant="outline">{selectedAd.format}</Badge> : null}
                  {selectedAd.isActive === true ? <Badge variant="success">{isVietnamese ? "Đang chạy" : "Currently running"}</Badge> : null}
                </div>

                <div>
                  <FieldLabel id={`${id}-review-status`}>{isVietnamese ? "Trạng thái duyệt" : "Review status"}</FieldLabel>
                  <ToggleGroup
                    value={[selectedAd.evidence.status]}
                    onValueChange={(value) => {
                      const next = value[0] as CompetitorEvidenceStatus | undefined;
                      if (next) onEvidenceStatusChange(selectedAd.id, next);
                    }}
                    variant="outline"
                    spacing={1}
                    className="mt-2 flex-wrap"
                    aria-labelledby={`${id}-review-status`}
                  >
                    <ToggleGroupItem value="accepted" className="min-h-11" disabled={!selectedEvidenceSourceUrl || !selectedAd.evidence.matchedToCompetitor}>
                      <CheckIcon data-icon="inline-start" />{isVietnamese ? "Xác minh" : "Verify"}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="needs_review" className="min-h-11">{isVietnamese ? "Cần duyệt" : "Needs review"}</ToggleGroupItem>
                    <ToggleGroupItem value="rejected" className="min-h-11">{isVietnamese ? "Loại" : "Reject"}</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <dl className="grid gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{isVietnamese ? "Đối thủ yêu cầu" : "Requested competitor"}</dt>
                    <dd className="mt-1 font-medium">{selectedAd.evidence.requestedCompetitor}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{isVietnamese ? "Advertiser quan sát" : "Observed advertiser"}</dt>
                    <dd className="mt-1 font-medium">{selectedAd.evidence.advertiser || (isVietnamese ? "Chưa rõ" : "Unknown")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{isVietnamese ? "Độ khớp" : "Match"}</dt>
                    <dd className="mt-1"><Badge variant="outline">{selectedAd.evidence.match}</Badge></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{isVietnamese ? "Nguồn" : "Source"}</dt>
                    <dd className="mt-1 font-medium">{sourceLabel(selectedAd)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{isVietnamese ? "Thu thập lúc" : "Captured"}</dt>
                    <dd className="mt-1 font-medium">{formatTimestamp(selectedAd.evidence.collectedAt, language)}</dd>
                  </div>
                </dl>

                <Separator />

                <div>
                  <div className="text-sm font-semibold">{selectedAd.headline || (isVietnamese ? "Nội dung creative" : "Creative evidence")}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {selectedAd.body || selectedAd.description || (isVietnamese ? "Không có nội dung creative." : "No creative copy returned.")}
                  </p>
                </div>

                {selectedEvidenceSourceUrl ? (
                  <a
                    href={selectedEvidenceSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {isVietnamese ? "Mở record gốc trong Meta Ad Library" : "Open original Meta Ad Library record"}
                    <ExternalLinkIcon className="size-4" aria-hidden="true" />
                  </a>
                ) : (
                  <Alert>
                    <AlertTitle>{isVietnamese ? "Thiếu liên kết nguồn" : "Source link missing"}</AlertTitle>
                    <AlertDescription>
                      {isVietnamese ? "Không nên xác minh record này cho đến khi có provenance có thể mở." : "Do not verify this record until openable provenance is available."}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <StickyActionDock
        position="fixed"
        contextLabel={isVietnamese ? "Evidence đối thủ" : "Competitor evidence"}
        status={effectiveDockStatus}
        statusLabel={dockStatusLabel}
        statusBadge={collectedAds.length > 0 ? `${matchedAds.length}/${collectedAds.length}` : acceptedCount > 0 ? acceptedCount : undefined}
        primaryAction={workflowStage === "setup" ? {
          id: "setup-competitor-evidence",
          label: isVietnamese ? "Thêm đối thủ" : "Add competitors",
          shortLabel: isVietnamese ? "Thiết lập" : "Set up",
          icon: PlusIcon,
          onSelect: () => setSetupOpen(true),
        } : workflowStage === "recover" ? {
          id: "recover-competitor-evidence",
          label: isVietnamese ? "Thêm URL Ad Library chính xác" : "Add exact Ad Library URL",
          shortLabel: isVietnamese ? "Thêm URL" : "Add URL",
          icon: LinkIcon,
          onSelect: addExactLibraryUrl,
        } : workflowStage === "review" ? {
          id: "review-competitor-evidence",
          label: isVietnamese ? "Duyệt evidence" : "Review evidence",
          shortLabel: isVietnamese ? "Duyệt" : "Review",
          icon: ShieldCheckIcon,
          onSelect: reviewEvidence,
          badge: reviewCount,
        } : workflowStage === "collect" ? {
          id: "collect-competitor-evidence",
          label: isVietnamese ? "Thu thập evidence" : "Collect evidence",
          shortLabel: isVietnamese ? "Thu thập" : "Collect",
          icon: RefreshCcwIcon,
          onSelect: onCollect,
          disabled: !collectionAvailable || collecting || analyzing,
          disabledReason: !collectionAvailable
              ? isVietnamese ? "Cấu hình Apify hoặc thêm note có URL Meta." : "Configure Apify or add a note with a Meta source URL."
              : isVietnamese ? "Chờ thao tác hiện tại hoàn tất." : "Wait for the current action to finish.",
          loading: collecting,
        } : {
          id: "analyze-competitor-evidence",
          label: isVietnamese ? "Phân tích evidence" : "Analyze evidence",
          shortLabel: isVietnamese ? "Phân tích" : "Analyze",
          icon: SearchIcon,
          onSelect: onGenerate,
          disabled: !canAnalyze,
          disabledReason: isVietnamese ? "Xác minh ít nhất một evidence có provenance." : "Verify at least one evidence item with provenance.",
          loading: analyzing,
          shortcut: "mod+enter",
        }}
        secondaryActions={[
          ...(workflowStage === "recover" ? [{
            id: "browse-collected-competitor-ads",
            label: isVietnamese ? "Xem ads đã thu thập" : "Browse collected ads",
            icon: LayoutGridIcon,
            badge: collectedAds.length,
            onSelect: browseCollectedAds,
          }] : []),
          ...(workflowStage !== "setup" ? [{
            id: "configure-competitor-evidence",
            label: isVietnamese ? "Nguồn & đối thủ" : "Sources & competitors",
            icon: SlidersHorizontalIcon,
            onSelect: () => setSetupOpen(true),
          }] : []),
          ...(workflowStage === "analyze" && reviewCount > 0 ? [{
            id: "review-competitor-evidence",
            label: isVietnamese ? "Duyệt evidence" : "Review evidence",
            icon: ShieldCheckIcon,
            badge: reviewCount,
            onSelect: reviewEvidence,
          }] : []),
          ...(workflowStage === "analyze" && reviewCount === 0 && collectionAvailable ? [{
            id: "refresh-competitor-evidence",
            label: isVietnamese ? "Thu thập lại" : "Refresh evidence",
            icon: RefreshCcwIcon,
            onSelect: onCollect,
            disabled: collecting || analyzing,
            loading: collecting,
          }] : []),
        ]}
        actionsLabel={isVietnamese ? "Hành động khác" : "More actions"}
      />
    </div>
  );
}
