"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  DatabaseIcon,
  DownloadIcon,
  Grid2X2Icon,
  ShieldAlertIcon,
  SparklesIcon,
} from "lucide-react";
import type { DashboardReport, TikTokLibraryReport } from "@/lib/types";
import {
  applyIncrementalityOverlay,
  audienceOverlapMatrix,
  buildAudienceFingerprint,
  buildCrossChannelSnapshot,
  recommendAudienceConsolidation,
  type AttributionModel,
  type AudienceFingerprint,
  type CanonicalQualityGate,
  type CrossChannelSnapshot,
  type IncrementalityStudy,
  type PlatformSummary,
} from "@/lib/cross-channel";
import { jsonFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CrossChannelIntelligenceProps = {
  report: DashboardReport | null;
  tiktokReport: TikTokLibraryReport | null;
  language: "en" | "vi";
};

function gateVariant(status: CanonicalQualityGate["status"]) {
  if (status === "pass") return "success" as const;
  if (status === "warning") return "outline" as const;
  return "destructive" as const;
}

function GateIcon({ status }: { status: CanonicalQualityGate["status"] }) {
  if (status === "pass")
    return <CheckCircle2Icon className="size-4 text-emerald-400" />;
  if (status === "warning")
    return <CircleDashedIcon className="size-4 text-amber-300" />;
  return <ShieldAlertIcon className="size-4 text-red-300" />;
}

function formatMoney(value: number, currency = "VND") {
  return new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

type ComparisonRow = Pick<
  PlatformSummary,
  | "spend"
  | "impressions"
  | "clicks"
  | "conversions"
  | "revenue"
  | "cpa"
  | "roas"
> & {
  label: string;
  authority: string;
  platform?: PlatformSummary["platform"];
  creativeCount?: number;
};

export function CrossChannelIntelligence({
  report,
  tiktokReport,
  language,
}: CrossChannelIntelligenceProps) {
  const [attributionModel, setAttributionModel] =
    React.useState<AttributionModel>("last_click");
  const [customClickWeight, setCustomClickWeight] = React.useState(1);
  const [customViewWeight, setCustomViewWeight] = React.useState(0);
  const [ltv, setLtv] = React.useState(0);
  const [incrementality, setIncrementality] =
    React.useState<IncrementalityStudy | null>(null);
  const [lift, setLift] = React.useState(0);
  const [remoteSnapshot, setRemoteSnapshot] =
    React.useState<CrossChannelSnapshot | null>(null);
  const [pivot, setPivot] = React.useState<"platform" | "authority">(
    "platform",
  );
  const [sortKey, setSortKey] = React.useState<keyof ComparisonRow>("spend");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc",
  );
  const [audiences, setAudiences] = React.useState<AudienceFingerprint[]>([]);
  const [targetingJson, setTargetingJson] = React.useState("{}");
  const [audienceMessage, setAudienceMessage] = React.useState("");
  const [selectedPlatform, setSelectedPlatform] = React.useState<
    PlatformSummary["platform"] | "all"
  >("all");
  const localSnapshot: CrossChannelSnapshot = React.useMemo(
    () =>
      buildCrossChannelSnapshot({
        metaReport: report,
        tiktokReport,
        attributionModel,
        customAttributionWeights: {
          click: customClickWeight,
          view: customViewWeight,
        },
        ltv,
      }),
    [
      attributionModel,
      customClickWeight,
      customViewWeight,
      ltv,
      report,
      tiktokReport,
    ],
  );
  const snapshot = remoteSnapshot || localSnapshot;
  const isVietnamese = language === "vi";
  const currency = report?.account.currency || "VND";
  const statusLabel = (status: CanonicalQualityGate["status"]) =>
    status === "pass"
      ? isVietnamese
        ? "Đạt"
        : "Pass"
      : status === "warning"
        ? isVietnamese
          ? "Cảnh báo"
          : "Warning"
        : isVietnamese
          ? "Lỗi"
          : "Fail";
  const incrementalityOverlay = incrementality
    ? applyIncrementalityOverlay(snapshot.executive, incrementality)
    : null;

  const comparisonRows = React.useMemo<ComparisonRow[]>(() => {
    const publicCreativeCount = tiktokReport?.rows.length || 0;
    const rows: ComparisonRow[] =
      pivot === "platform"
        ? snapshot.platforms.map((item) => ({
            label: item.platform.replaceAll("_", " "),
            platform: item.platform,
            authority: item.authority.replaceAll("_", " "),
            spend: item.spend,
            impressions: item.impressions,
            clicks: item.clicks,
            conversions: item.conversions,
            revenue: item.revenue,
            cpa: item.cpa,
            roas: item.roas,
            creativeCount: item.rowCount,
          }))
        : (() => {
            const owned = snapshot.platforms.reduce(
              (result, item) => ({
                spend: result.spend + item.spend,
                impressions: result.impressions + item.impressions,
                clicks: result.clicks + item.clicks,
                conversions: result.conversions + item.conversions,
                revenue: result.revenue + item.revenue,
              }),
              {
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                revenue: 0,
              },
            );
            return [
              {
                label: "owned performance",
                authority: "owned performance",
                ...owned,
                cpa:
                  owned.conversions > 0 ? owned.spend / owned.conversions : 0,
                roas: owned.spend > 0 ? owned.revenue / owned.spend : 0,
                creativeCount: snapshot.creativeRows.filter(
                  (item) => item.authority === "owned_performance",
                ).length,
              },
              ...(publicCreativeCount
                ? [
                    {
                      label: "public intelligence",
                      authority: "public intelligence",
                      spend: 0,
                      impressions: 0,
                      clicks: 0,
                      conversions: 0,
                      revenue: 0,
                      cpa: 0,
                      roas: 0,
                      creativeCount: publicCreativeCount,
                    },
                  ]
                : []),
            ];
          })();
    return rows.sort((left, right) => {
      const a = left[sortKey];
      const b = right[sortKey];
      const order =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b));
      return sortDirection === "asc" ? order : -order;
    });
  }, [pivot, snapshot, sortDirection, sortKey, tiktokReport]);
  const audienceAlerts = React.useMemo(
    () => audienceOverlapMatrix(audiences),
    [audiences],
  );
  const audienceRecommendations = React.useMemo(
    () => recommendAudienceConsolidation(audiences),
    [audiences],
  );
  const selectedCreatives = React.useMemo(
    () =>
      snapshot.creativeDrillthrough.filter(
        (creative) =>
          selectedPlatform === "all" || creative.platform === selectedPlatform,
      ),
    [selectedPlatform, snapshot.creativeDrillthrough],
  );

  React.useEffect(() => {
    let cancelled = false;
    setRemoteSnapshot(null);
    void jsonFetch<{ snapshot: CrossChannelSnapshot }>(
      "/api/intelligence/summary",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metaReport: report,
          tiktokReport,
          attributionModel,
          customAttributionWeights: {
            click: customClickWeight,
            view: customViewWeight,
          },
          ltv,
        }),
        timeoutMs: 12000,
      },
    )
      .then((data) => {
        if (!cancelled) setRemoteSnapshot(data.snapshot);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    attributionModel,
    customClickWeight,
    customViewWeight,
    ltv,
    report,
    tiktokReport,
  ]);

  React.useEffect(() => {
    const targeting = new Map(
      (report?.adsetTargeting || []).map((item) => [
        item.adSetId,
        item.criteria,
      ]),
    );
    const rows = (report?.adsetRows || []).slice(0, 10).map((row) => {
      const adSetId = row.adsetId || row.id;
      const criteria = targeting.get(adSetId) || [];
      return buildAudienceFingerprint({
        platform: "meta",
        adSetId,
        spend: row.spend,
        criteria,
      });
    });
    setAudiences(rows);
  }, [report]);

  React.useEffect(() => {
    void jsonFetch<{ latest: IncrementalityStudy | null }>(
      "/api/intelligence/incrementality",
      { timeoutMs: 5000 },
    )
      .then((data) => setIncrementality(data.latest))
      .catch(() => undefined);
  }, []);

  async function saveLift() {
    if (!Number.isFinite(lift) || lift === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const study = await jsonFetch<{ study: IncrementalityStudy }>(
      "/api/intelligence/incrementality",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: `geo-lift-${today}`,
          method: "geo_lift",
          startDate: snapshot.dateRange.since || today,
          endDate: snapshot.dateRange.until || today,
          lift: lift / 100,
        }),
        timeoutMs: 5000,
      },
    );
    setIncrementality(study.study);
  }

  function exportCsv() {
    const rows = [
      [
        pivot,
        "authority",
        "spend",
        "impressions",
        "clicks",
        "conversions",
        "revenue",
        "roas",
      ],
      ...comparisonRows.map((item) => [
        item.label,
        item.authority,
        item.spend,
        item.impressions,
        item.clicks,
        item.conversions,
        item.revenue,
        item.roas,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cross-channel-${snapshot.dateRange.until || "snapshot"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text("Decision Workspace · Cross-channel comparison", 36, 42);
    doc.setFontSize(9);
    doc.text(
      `View: ${pivot} · Range: ${snapshot.dateRange.since || "—"} to ${snapshot.dateRange.until || "—"}`,
      36,
      58,
    );
    comparisonRows.forEach((item, index) => {
      const y = 84 + index * 16;
      doc.text(
        `${item.label} | ${item.authority} | spend ${formatMoney(item.spend, currency)} | conv ${formatCompact(item.conversions)} | CPA ${item.cpa ? formatMoney(item.cpa, currency) : "—"} | ROAS ${item.roas ? `${item.roas.toFixed(2)}x` : "—"}`,
        36,
        y,
      );
    });
    doc.save(`cross-channel-${snapshot.dateRange.until || "snapshot"}.pdf`);
  }

  function updateAudience(adSetId: string, criteria: string) {
    setAudiences((current) =>
      current.map((audience) =>
        audience.adSetId === adSetId
          ? buildAudienceFingerprint({
              ...audience,
              criteria: criteria.split(","),
            })
          : audience,
      ),
    );
  }

  async function runAudienceAction(
    recommendation: (typeof audienceRecommendations)[number],
    apply: boolean,
  ) {
    setAudienceMessage("");
    let targeting: Record<string, unknown> | undefined;
    if (apply) {
      try {
        targeting = JSON.parse(targetingJson) as Record<string, unknown>;
      } catch {
        setAudienceMessage(
          isVietnamese
            ? "Targeting JSON không hợp lệ."
            : "Targeting JSON is invalid.",
        );
        return;
      }
    }
    try {
      const response = await jsonFetch<{ audit: { status: string } }>(
        "/api/intelligence/audience/consolidate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: recommendation.action,
            leftId: recommendation.leftId,
            rightId: recommendation.rightId,
            overlap: recommendation.overlap,
            apply,
            targeting,
          }),
          timeoutMs: 10000,
        },
      );
      setAudienceMessage(
        `${recommendation.action} ${apply ? "applied" : "planned"} · ${response.audit.status}`,
      );
    } catch (error) {
      setAudienceMessage(
        error instanceof Error ? error.message : "Audience action failed.",
      );
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardDescription>
                {isVietnamese
                  ? "Canonical data layer · schema 1.0"
                  : "Canonical data layer · schema 1.0"}
              </CardDescription>
              <CardTitle className="text-2xl">
                {isVietnamese
                  ? "Cross-channel intelligence"
                  : "Cross-channel intelligence"}
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {isVietnamese
                  ? "Hiệu quả owned được dùng cho CPA/ROAS và phân bổ. TikTok public chỉ đóng vai trò creative intelligence, không được trộn vào budget move."
                  : "Owned performance powers CPA/ROAS and allocation context. Public TikTok stays creative intelligence and never becomes a budget move source."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{isVietnamese ? "Attribution" : "Attribution"}</span>
                <select
                  value={attributionModel}
                  onChange={(event) =>
                    setAttributionModel(event.target.value as AttributionModel)
                  }
                  className="h-8 rounded-lg border bg-background px-2 text-xs text-foreground"
                >
                  <option value="last_click">Last click</option>
                  <option value="7d_click_1d_view">7d click + 1d view</option>
                  <option value="data_driven">Data-driven</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {attributionModel === "custom" ? (
                <>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Click weight</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={customClickWeight}
                      onChange={(event) =>
                        setCustomClickWeight(Number(event.target.value) || 0)
                      }
                      className="h-8 w-20 rounded-lg border bg-background px-2 text-xs text-foreground"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>View weight</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={customViewWeight}
                      onChange={(event) =>
                        setCustomViewWeight(Number(event.target.value) || 0)
                      }
                      className="h-8 w-20 rounded-lg border bg-background px-2 text-xs text-foreground"
                    />
                  </label>
                </>
              ) : null}
              {attributionModel === "data_driven" ? (
                <Badge
                  variant={
                    snapshot.attribution.source === "ga4_data_api"
                      ? "success"
                      : "outline"
                  }
                >
                  {snapshot.attribution.source === "ga4_data_api"
                    ? "GA4 data-driven"
                    : "Last-click fallback"}
                </Badge>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>LTV</span>
                <input
                  type="number"
                  min="0"
                  value={ltv || ""}
                  onChange={(event) => setLtv(Number(event.target.value) || 0)}
                  placeholder="—"
                  className="h-8 w-24 rounded-lg border bg-background px-2 text-xs text-foreground"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Pivot</span>
                <select
                  value={pivot}
                  onChange={(event) =>
                    setPivot(event.target.value as "platform" | "authority")
                  }
                  className="h-8 rounded-lg border bg-background px-2 text-xs text-foreground"
                >
                  <option value="platform">Platform</option>
                  <option value="authority">Authority</option>
                </select>
              </label>
              <button
                type="button"
                onClick={exportCsv}
                className="h-8 rounded-lg border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => void exportPdf()}
                className="flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <DownloadIcon className="size-3.5" />
                PDF
              </button>
              <Badge
                variant={
                  snapshot.performanceRows.length > 0 ? "success" : "outline"
                }
              >
                {snapshot.performanceRows.length > 0
                  ? isVietnamese
                    ? "Owned data loaded"
                    : "Owned data loaded"
                  : isVietnamese
                    ? "Chờ kết nối"
                    : "Awaiting connector"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              isVietnamese ? "Spend" : "Spend",
              formatMoney(snapshot.totals.spend, currency),
            ],
            [
              isVietnamese ? "Conversions" : "Conversions",
              formatCompact(snapshot.totals.conversions),
            ],
            [
              "CPA",
              snapshot.executive.blendedCpa
                ? formatMoney(snapshot.executive.blendedCpa, currency)
                : "—",
            ],
            [
              "ROAS",
              snapshot.executive.blendedRoas
                ? `${snapshot.executive.blendedRoas.toFixed(2)}x`
                : "—",
            ],
            [
              "CAC:LTV",
              snapshot.executive.cacLtv
                ? `1:${snapshot.executive.cacLtv.toFixed(2)}`
                : "—",
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 font-heading text-xl font-semibold">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl border bg-background text-muted-foreground">
                <DatabaseIcon className="size-4" />
              </span>
              <div>
                <CardTitle>
                  {isVietnamese ? "Platform comparison" : "Platform comparison"}
                </CardTitle>
                <CardDescription>
                  {isVietnamese
                    ? "Chỉ các nguồn owned được tính vào blended metrics."
                    : "Only owned sources contribute to blended metrics."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {snapshot.platforms.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="border-b text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    <tr>
                      {(
                        [
                          [
                            "label",
                            pivot === "platform" ? "Platform" : "Authority",
                          ],
                          ["authority", "Authority"],
                          ["spend", "Spend"],
                          ["conversions", "Conversions"],
                          ["cpa", "CPA"],
                          ["roas", "ROAS"],
                        ] as Array<[keyof ComparisonRow, string]>
                      ).map(([key, label]) => (
                        <th
                          key={key}
                          className={`pb-3 ${key === "spend" || key === "conversions" || key === "cpa" || key === "roas" ? "text-right" : "text-left"}`}
                        >
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 uppercase tracking-[0.1em]"
                            onClick={() => {
                              if (sortKey === key)
                                setSortDirection((current) =>
                                  current === "asc" ? "desc" : "asc",
                                );
                              else {
                                setSortKey(key);
                                setSortDirection("desc");
                              }
                            }}
                          >
                            {label}
                            {sortKey === key ? (
                              sortDirection === "asc" ? (
                                <ArrowUpIcon className="size-3" />
                              ) : (
                                <ArrowDownIcon className="size-3" />
                              )
                            ) : null}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {comparisonRows.map((platform) => (
                      <tr
                        key={`${platform.label}-${platform.authority}`}
                        onClick={() =>
                          platform.platform &&
                          setSelectedPlatform(platform.platform)
                        }
                        className={
                          platform.platform
                            ? "cursor-pointer transition-colors hover:bg-muted/40"
                            : undefined
                        }
                        aria-selected={
                          platform.platform
                            ? selectedPlatform === platform.platform
                            : undefined
                        }
                      >
                        <td className="py-3 font-medium capitalize">
                          {platform.label}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              platform.authority === "public intelligence"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {platform.authority}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          {platform.spend
                            ? formatMoney(platform.spend, currency)
                            : "—"}
                        </td>
                        <td className="py-3 text-right">
                          {platform.conversions
                            ? formatCompact(platform.conversions)
                            : "—"}
                        </td>
                        <td className="py-3 text-right">
                          {platform.cpa
                            ? formatMoney(platform.cpa, currency)
                            : "—"}
                        </td>
                        <td className="py-3 text-right">
                          {platform.roas ? `${platform.roas.toFixed(2)}x` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                {isVietnamese
                  ? "Kết nối Meta để nạp performance rows; bạn vẫn có thể dùng TikTok public cho creative research."
                  : "Connect Meta to load performance rows; TikTok public can still support creative research."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl border bg-background text-muted-foreground">
                <SparklesIcon className="size-4" />
              </span>
              <div>
                <CardTitle>
                  {isVietnamese ? "Data quality gates" : "Data quality gates"}
                </CardTitle>
                <CardDescription>
                  {isVietnamese
                    ? "Chặn silent drift trước khi ra quyết định."
                    : "Catch silent drift before decisions are made."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {snapshot.quality.map((gate) => (
              <div
                key={gate.id}
                className="flex items-start gap-3 rounded-xl border p-3"
              >
                <GateIcon status={gate.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium capitalize">
                      {gate.id.replaceAll("_", " ")}
                    </p>
                    <Badge variant={gateVariant(gate.status)}>
                      {statusLabel(gate.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {gate.detail}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl border bg-background text-muted-foreground">
                <Grid2X2Icon className="size-4" />
              </span>
              <div>
                <CardTitle>
                  {isVietnamese
                    ? "Audience overlap & cannibalization"
                    : "Audience overlap and cannibalization"}
                </CardTitle>
                <CardDescription>
                  {isVietnamese
                    ? "Fingerprint criteria theo ad set; Jaccard overlap và ngưỡng $50/ngày."
                    : "Fingerprint targeting criteria by ad set; Jaccard overlap and the $50/day threshold."}
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={audienceRecommendations.length ? "outline" : "success"}
            >
              {audienceRecommendations.length
                ? `${audienceRecommendations.length} alert(s)`
                : "No active alert"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
          {audiences.length ? (
            <div className="grid gap-3">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="border-b text-left uppercase tracking-[.1em] text-muted-foreground">
                    <tr>
                      <th className="p-3">Ad set / native criteria</th>
                      {audiences.map((audience) => (
                        <th key={audience.adSetId} className="p-3 text-center">
                          {audience.adSetId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {audiences.map((audience) => (
                      <tr key={audience.adSetId}>
                        <td className="min-w-[240px] p-3">
                          <div className="font-medium">{audience.adSetId}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            ${audience.spend.toFixed(0)}/day · normalized
                            platform targeting; edit below
                          </div>
                          <input
                            value={audience.criteria.join(", ")}
                            onChange={(event) =>
                              updateAudience(
                                audience.adSetId,
                                event.target.value,
                              )
                            }
                            className="mt-2 h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                          />
                        </td>
                        {audiences.map((other) => {
                          const overlap =
                            audience.adSetId === other.adSetId
                              ? null
                              : audienceAlerts.find(
                                  (alert) =>
                                    (alert.leftId === audience.adSetId &&
                                      alert.rightId === other.adSetId) ||
                                    (alert.leftId === other.adSetId &&
                                      alert.rightId === audience.adSetId),
                                )?.overlap;
                          return (
                            <td
                              key={other.adSetId}
                              className={`p-3 text-center tabular-nums ${overlap !== undefined && overlap !== null && overlap > 0.3 ? "bg-amber-400/10 text-amber-200" : "text-muted-foreground"}`}
                            >
                              {overlap === null
                                ? "—"
                                : overlap === undefined
                                  ? "0%"
                                  : `${(overlap * 100).toFixed(0)}%`}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                Audience criteria are a local fingerprinting proxy until a
                platform connector supplies native targeting objects. Public
                TikTok rows never enter this matrix.
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              {isVietnamese
                ? "Cần ad set owned để lập overlap matrix."
                : "Owned ad-set rows are required to build the overlap matrix."}
            </p>
          )}
          <div className="grid content-start gap-3">
            {audienceRecommendations.length ? (
              audienceRecommendations.map((recommendation) => (
                <div key={recommendation.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">
                      {(recommendation.overlap * 100).toFixed(0)}% overlap
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {recommendation.action}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5">
                    {recommendation.rationale}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void runAudienceAction(recommendation, false)
                      }
                    >
                      Dry run
                    </Button>
                    {recommendation.apiSupported ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          void runAudienceAction(recommendation, true)
                        }
                      >
                        Apply exclusion
                      </Button>
                    ) : (
                      <Badge variant="secondary">Manual merge</Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {isVietnamese
                  ? "Chưa có overlap vượt ngưỡng."
                  : "No overlap exceeds the consolidation threshold."}
              </p>
            )}
            {audienceRecommendations.some((item) => item.apiSupported) ? (
              <label className="grid gap-1 text-xs text-muted-foreground">
                <span>Advanced Meta targeting JSON for apply</span>
                <textarea
                  value={targetingJson}
                  onChange={(event) => setTargetingJson(event.target.value)}
                  rows={3}
                  className="rounded-lg border bg-background p-2 font-mono text-[11px] text-foreground"
                />
              </label>
            ) : null}
            {audienceMessage ? (
              <p className="text-xs text-muted-foreground">{audienceMessage}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {isVietnamese ? "Performance trend" : "Performance trend"}
          </CardTitle>
          <CardDescription>
            {isVietnamese
              ? "Spend và conversion theo ngày từ canonical daily grain."
              : "Daily spend and conversions from the canonical daily grain."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshot.executive.trend.length ? (
            <div className="flex h-36 items-end gap-1 overflow-x-auto border-b pb-2">
              {snapshot.executive.trend.slice(-31).map((point) => {
                const maxSpend = Math.max(
                  ...snapshot.executive.trend.map((item) => item.spend),
                  1,
                );
                return (
                  <div
                    key={point.date}
                    className="group flex min-w-5 flex-1 items-end"
                    title={`${point.date}: ${formatMoney(point.spend, currency)} · ${point.conversions} conversions`}
                  >
                    <div
                      className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                      style={{
                        height: `${Math.max(4, (point.spend / maxSpend) * 100)}%`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              {isVietnamese
                ? "Cần daily grain để hiển thị trend."
                : "Daily-grain rows are required to display the trend."}
            </p>
          )}
        </CardContent>
      </Card>

      {snapshot.warnings.length ? (
        <Card className="border-amber-400/30 bg-amber-400/5">
          <CardHeader>
            <CardTitle className="text-base">
              {isVietnamese ? "Ranh giới quyết định" : "Decision boundary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            {snapshot.warnings[0]}
          </CardContent>
        </Card>
      ) : null}
      {snapshot.attribution.warning ? (
        <Card className="border-amber-400/30 bg-amber-400/5">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            {snapshot.attribution.warning}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {isVietnamese ? "Incrementality overlay" : "Incrementality overlay"}
          </CardTitle>
          <CardDescription>
            {isVietnamese
              ? "Nạp kết quả geo-lift/PSA để đặt observed performance cạnh incremental effect."
              : "Ingest geo-lift or PSA results beside observed performance."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            <span>{isVietnamese ? "Geo lift (%)" : "Geo lift (%)"}</span>
            <input
              type="number"
              step="0.1"
              value={lift || ""}
              onChange={(event) => setLift(Number(event.target.value) || 0)}
              className="h-9 rounded-lg border bg-background px-3 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveLift()}
            disabled={!lift}
            className="h-9 rounded-lg border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVietnamese ? "Lưu study" : "Save study"}
          </button>
          <div className="rounded-xl border px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              {isVietnamese ? "Lift hiện tại" : "Current lift"}:{" "}
            </span>
            <strong>
              {incrementalityOverlay
                ? `${(incrementalityOverlay.incrementality.lift * 100).toFixed(1)}%`
                : "—"}
            </strong>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>
                {isVietnamese
                  ? "Creative drill-through"
                  : "Creative drill-through"}
              </CardTitle>
              <CardDescription>
                {selectedPlatform === "all"
                  ? isVietnamese
                    ? "Chọn một dòng platform để lọc gallery creative."
                    : "Click a platform row to filter the creative gallery."
                  : `Showing ${selectedPlatform.replaceAll("_", " ")} creatives linked by immutable creative ID.`}
              </CardDescription>
            </div>
            {selectedPlatform !== "all" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelectedPlatform("all")}
              >
                Clear filter
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {selectedCreatives.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {selectedCreatives.slice(0, 12).map((creative) => (
                <div
                  key={`${creative.platform}-${creative.creativeId}`}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {creative.title || creative.creativeId}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {creative.platform} ·{" "}
                      {creative.authority.replaceAll("_", " ")} ·{" "}
                      {creative.format}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>
                      {creative.spend
                        ? formatMoney(creative.spend, currency)
                        : "Public"}
                    </div>
                    <div>
                      {creative.conversions
                        ? `${formatCompact(creative.conversions)} conv.`
                        : "No owned result"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              {isVietnamese
                ? "Chưa có creative linkage trong snapshot này."
                : "No creative linkage is present for this filter."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
