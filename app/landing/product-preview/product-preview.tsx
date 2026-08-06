"use client"

import * as React from "react"

import { CompetitorEvidenceWorkspace } from "@/components/dashboard/competitor-evidence-workspace"
import { WorkspaceOverview } from "@/components/dashboard/workspace-overview"
import { buildCapabilitySnapshot } from "@/lib/capabilities"
import { summarizeHealth } from "@/lib/health-score"
import { buildSampleReport } from "@/lib/sample-report"
import type { CompetitorFetchResult, CompetitorSpyResult } from "@/lib/types"

import styles from "./preview.module.css"

const capabilities = buildCapabilitySnapshot({
  authenticated: true,
  apifyConfigured: true,
  competitorActorConfigured: true,
  tiktokAdLibraryConfigured: true,
  nineRouterConfigured: false,
  googleAdsConfigured: false,
  linkedinConfigured: false,
})

const competitorEvidence: CompetitorFetchResult = {
  source: "apify",
  outcome: "matched",
  fetchedAt: "2026-07-31T08:20:00.000Z",
  warnings: [],
  coverage: [
    { competitor: "Northstar Studio", collected: 3, matched: 3, mediaReady: 3, accepted: 2, needsReview: 1, rejected: 0 },
  ],
  ads: [
    {
      id: "preview-ad-01",
      source: "apify",
      competitorName: "Northstar Studio",
      pageName: "Northstar Studio",
      headline: "A clearer promise in the first three seconds",
      body: "Warranty-led creative paired with a short product demonstration and a single proof point.",
      cta: "Learn More",
      format: "Video",
      isActive: true,
      imageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=84",
      evidence: {
        status: "accepted",
        match: "exact",
        reason: "exact_advertiser_trusted_source",
        matchedToCompetitor: true,
        hasUsableCreative: true,
        requestedCompetitor: "Northstar Studio",
        advertiser: "Northstar Studio",
        sourceUrl: "https://www.facebook.com/ads/library/",
        collectedAt: "2026-07-31T08:20:00.000Z",
      },
    },
    {
      id: "preview-ad-02",
      source: "apify",
      competitorName: "Northstar Studio",
      pageName: "Northstar Studio",
      headline: "Creator proof before the product close-up",
      body: "A creator-format opener leads into a concise feature comparison and offer frame.",
      cta: "Shop Now",
      format: "Image",
      isActive: true,
      imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=84",
      evidence: {
        status: "accepted",
        match: "exact",
        reason: "exact_advertiser_trusted_source",
        matchedToCompetitor: true,
        hasUsableCreative: true,
        requestedCompetitor: "Northstar Studio",
        advertiser: "Northstar Studio",
        sourceUrl: "https://www.facebook.com/ads/library/",
        collectedAt: "2026-07-31T08:17:00.000Z",
      },
    },
    {
      id: "preview-ad-03",
      source: "apify",
      competitorName: "Northstar Studio",
      pageName: "Northstar Studios",
      headline: "One offer, four opening angles",
      body: "A repeated offer frame appears across several creative variants and needs advertiser review.",
      cta: "Get Offer",
      format: "Image",
      isActive: true,
      imageUrl: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=84",
      evidence: {
        status: "needs_review",
        match: "ambiguous",
        reason: "similar_advertiser",
        matchedToCompetitor: true,
        hasUsableCreative: true,
        requestedCompetitor: "Northstar Studio",
        advertiser: "Northstar Studios",
        sourceUrl: "https://www.facebook.com/ads/library/",
        collectedAt: "2026-07-31T08:12:00.000Z",
      },
    },
  ],
}

const competitorResult: CompetitorSpyResult = {
  summary: "Risk-reversal and creator proof are the clearest recurring patterns in the verified set.",
  competitors: [
    {
      name: "Northstar Studio",
      likely_positioning: "Low-friction premium service",
      observed_or_expected_patterns: ["Warranty-led hooks", "Creator proof", "Repeated offer frames"],
      gap: "Little evidence of process transparency after the initial hook.",
    },
  ],
  themes: [
    {
      theme: "Risk reversal first",
      evidence: "The warranty promise leads the strongest verified creative.",
      evidence_ids: ["preview-ad-01"],
      opportunity: "Test an original guarantee-led opener without copying the competitor script.",
      confidence: "high",
    },
  ],
  creative_gaps: ["Show the operating process, not only the outcome."],
  test_briefs: [
    {
      angle: "Transparent process",
      hook: "See exactly what happens before you commit.",
      format: "Creator-led vertical video",
      why: "Counters the competitor's outcome-only story with proof of method.",
      guardrail: "Use original footage and claims supported by your own service data.",
    },
  ],
  next_actions: ["Draft two original hooks", "Review advertiser match", "Launch one controlled test"],
  assumptions: ["Public ad-library delivery does not reveal conversion performance."],
  provider: "prompt",
}

const noop = () => undefined

export function LandingProductPreview({ surface }: { surface: "overview" | "competitor" }) {
  const [mounted, setMounted] = React.useState(false)
  const report = React.useMemo(
    () => buildSampleReport({ dateRange: { since: "2026-07-01", until: "2026-07-30" } }),
    [],
  )
  const healthSummary = React.useMemo(() => summarizeHealth(report), [report])

  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <main className={`${styles.preview} light`} data-surface={surface} aria-busy="true">
        <div className={styles.loadingSurface}>
          <span />
          <span />
          <span />
        </div>
      </main>
    )
  }

  return (
    <main className={`${styles.preview} light`} data-surface={surface}>
      {surface === "overview" ? (
        <WorkspaceOverview
          authenticated
          capabilities={capabilities}
          language="en"
          userName="Tien Duong"
          workspaceLabel="Tien Duong"
          report={report}
          healthSummary={healthSummary}
          savedReports={[]}
          restoredReportId={null}
          onOpen={noop}
          onEditScope={noop}
          onRestoreReport={noop}
        />
      ) : (
        <CompetitorEvidenceWorkspace
          names="Northstar Studio"
          market="Vietnam"
          platform="meta"
          libraryUrls="https://www.facebook.com/ads/library/"
          notes=""
          evidence={competitorEvidence}
          result={competitorResult}
          collecting={false}
          analyzing={false}
          error=""
          capabilityState="available"
          language="en"
          provider="prompt"
          copiedPrompt={false}
          onNamesChange={noop}
          onMarketChange={noop}
          onPlatformChange={noop}
          onNotesChange={noop}
          onLibraryUrlsChange={noop}
          onProviderChange={noop}
          onCollect={noop}
          onEvidenceStatusChange={noop}
          onGenerate={noop}
          onCopyPrompt={noop}
          onOpenAssistant={noop}
          chatShortcutsDisabled
        />
      )}
    </main>
  )
}
