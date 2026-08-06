"use client";

import * as React from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  DatabaseIcon,
  GaugeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TargetIcon,
  Trash2Icon,
} from "lucide-react";
import type { CapabilityState, CapabilityStatus } from "@/lib/capabilities";
import type { DashboardView } from "@/lib/dashboard-access";
import type { HealthScoreSummary } from "@/lib/health-score";
import type { DashboardReport } from "@/lib/types";
import type { SavedReportSnapshot } from "@/lib/report-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type WorkspaceOverviewProps = {
  authenticated: boolean;
  capabilities: CapabilityStatus[];
  language: "en" | "vi";
  userName: string;
  workspaceLabel?: string;
  report: DashboardReport | null;
  healthSummary: HealthScoreSummary | null;
  savedReports: SavedReportSnapshot[];
  restoredReportId: string | null;
  onOpen: (view: DashboardView) => void;
  onEditScope: () => void;
  onRestoreReport: (report: SavedReportSnapshot) => void;
  onClearReportHistory: () => Promise<boolean>;
};

const stateRank: Record<CapabilityState, number> = {
  available: 0,
  degraded: 1,
  needs_connection: 2,
  needs_setup: 3,
  paused: 4,
  unknown: 5,
};

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function currency(value: number, code: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: code || "VND",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

export function WorkspaceOverview({
  authenticated,
  capabilities,
  language,
  userName,
  workspaceLabel,
  report,
  healthSummary,
  savedReports,
  restoredReportId,
  onOpen,
  onEditScope,
  onRestoreReport,
  onClearReportHistory,
}: WorkspaceOverviewProps) {
  const [clearHistoryOpen, setClearHistoryOpen] = React.useState(false);
  const [clearingHistory, setClearingHistory] = React.useState(false);
  const isVietnamese = language === "vi";
  const availableCount = capabilities.filter((item) => item.state === "available").length;
  const totalChecks = healthSummary?.items.length || report?.health.checks.length || capabilities.length;
  const passedChecks = healthSummary?.counts.healthy ?? report?.health.checks.filter((check) => check.status === "pass").length ?? availableCount;
  const blockingCount = healthSummary?.counts.danger ?? capabilities.filter((item) => item.state === "needs_connection" || item.state === "needs_setup").length;
  const watchCount = healthSummary?.counts.warning ?? capabilities.filter((item) => item.state === "degraded" || item.state === "paused" || item.state === "unknown").length;
  const readinessLabel = blockingCount > 0
    ? (isVietnamese ? "Đang chặn" : "Blocked")
    : watchCount > 0
      ? (isVietnamese ? "Cần rà soát" : "Review")
      : (isVietnamese ? "Sẵn sàng" : "Ready");
  const accountName = report?.account.name || workspaceLabel || (authenticated ? (isVietnamese ? "Chọn tài khoản" : "Choose account") : (isVietnamese ? "Chưa kết nối" : "Not connected"));
  const period = report ? `${report.dateRange.since} – ${report.dateRange.until}` : (isVietnamese ? "30 ngày gần nhất" : "Last 30 days");
  const campaignScope = report?.selectedCampaigns.length
    ? report.selectedCampaigns.length === 1
      ? report.selectedCampaigns[0].name
      : `${report.selectedCampaigns.length} ${isVietnamese ? "campaign" : "campaigns"}`
    : (isVietnamese ? "Tất cả campaign active" : "All active campaigns");
  const ruleLabel = report?.source === "sample"
    ? "Auto · CPA 40 / ROAS 2.5"
    : report
      ? `${report.selectedPack.replaceAll("_", " ")} · ${report.health.grade}`
      : (isVietnamese ? "Tự nhận diện" : "Auto-detect");
  const attentionItems = healthSummary
    ? healthSummary.items.slice(0, 3).map((item) => ({
        id: item.id,
        severity: item.severity,
        titleText: item.title[language],
        detailText: item.detail[language],
      }))
    : [...capabilities]
        .sort((left, right) => stateRank[right.state] - stateRank[left.state])
        .slice(0, 3)
        .map((item) => ({
          id: item.key,
          severity: item.state === "unknown" || item.state === "paused" ? "danger" : "warning",
          titleText: capabilityName(item.key),
          detailText: capabilityStateDetail(item.state, language),
        }));
  const primaryAttention = attentionItems[0];
  const readinessDetail = blockingCount > 0
    ? (isVietnamese
        ? `Đang bị chặn bởi ${blockingCount} mục: ${primaryAttention?.titleText || "cần hoàn tất thiết lập dữ liệu"}.`
        : `Blocked by ${blockingCount}: ${primaryAttention?.titleText || "complete the required data setup"}.`)
    : watchCount > 0
      ? (isVietnamese
          ? `Sẵn sàng sau một lần rà soát: ${primaryAttention?.titleText || "kiểm tra tín hiệu cảnh báo"}. Không có mục đang chặn.`
          : `Ready after one review: ${primaryAttention?.titleText || "review the warning signal"}. No blocking checks.`)
      : (isVietnamese ? "Sẵn sàng hành động: tất cả kiểm tra bắt buộc đã đạt." : "Ready to act: all required checks passed.");

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-0.045em]">
            {isVietnamese ? `Chào buổi sáng, ${userName}.` : `Good morning, ${userName}.`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {report
              ? (isVietnamese ? "Báo cáo gần nhất đã sẵn sàng để tiếp tục." : "Your latest report is ready to continue.")
              : (isVietnamese ? "Chọn phạm vi để tạo báo cáo thật đầu tiên." : "Choose a scope to create your first real report.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onEditScope}>
            <SlidersHorizontalIcon data-icon="inline-start" />
            {isVietnamese ? "Sửa phạm vi" : "Edit scope"}
          </Button>
          <Button type="button" onClick={() => onOpen("ads")}>
            <BarChart3Icon data-icon="inline-start" />
            {isVietnamese ? "Chạy phân tích" : "Run analysis"}
          </Button>
        </div>
      </section>

      <section className="v2-panel grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_392px]">
        <div className="p-5 sm:p-6">
          <Badge variant={report ? "success" : "secondary"}>
            {report ? (isVietnamese ? "Báo cáo sẵn sàng" : "Report ready") : authenticated ? (isVietnamese ? "Đang chờ phạm vi" : "Scope required") : (isVietnamese ? "Chưa kết nối" : "Not connected")}
          </Badge>
          <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-[1.18] tracking-[-0.035em] sm:text-[30px]">
            {report
              ? (isVietnamese ? "Một phạm vi rõ ràng. Đủ tín hiệu để ra quyết định." : "One scope. Clear guardrails. Ready to diagnose.")
              : (isVietnamese ? "Khóa phạm vi trước. Sau đó chẩn đoán điều cần thay đổi." : "Lock the scope first. Then diagnose what needs to change.")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {isVietnamese ? "Các yếu tố cốt lõi được giữ cùng một chỗ để mọi kết luận luôn có thể truy ngược về dữ liệu." : "The essentials stay locked in one place so every conclusion remains traceable to its evidence."}
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ScopeMetric icon={DatabaseIcon} label={isVietnamese ? "Tài khoản" : "Account"} value={accountName} />
            <ScopeMetric icon={CalendarDaysIcon} label={isVietnamese ? "Thời gian" : "Period"} value={period} />
            <ScopeMetric icon={TargetIcon} label="Campaign" value={campaignScope} />
            <ScopeMetric icon={GaugeIcon} label={isVietnamese ? "Quy tắc" : "Rules"} value={ruleLabel} />
          </div>
        </div>

        <div className="border-t border-border bg-secondary/35 p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SparklesIcon className="size-4 text-primary" />
              {isVietnamese ? "Mức sẵn sàng hành động" : "Action readiness"}
            </div>
            <Badge variant={blockingCount > 0 ? "destructive" : watchCount > 0 ? "outline" : "success"}>{readinessLabel}</Badge>
          </div>
          <div className="mt-3 text-5xl font-semibold tracking-[-0.055em]">{passedChecks}<span className="text-2xl text-muted-foreground">/{Math.max(totalChecks, 1)}</span></div>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{readinessDetail}</p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span>{isVietnamese ? "Kiểm tra đã đạt" : "Checks passed"}</span>
            <span className="font-medium tabular-nums">{passedChecks}/{Math.max(totalChecks, 1)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(passedChecks / Math.max(totalChecks, 1)) * 100}%` }} />
          </div>
          <button type="button" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary" onClick={() => onOpen("ads")}>
            {blockingCount > 0
              ? (isVietnamese ? `Xử lý ${blockingCount} mục đang chặn` : `Resolve ${blockingCount} blocking item${blockingCount === 1 ? "" : "s"}`)
              : watchCount > 0
                ? (isVietnamese ? `Rà soát ${watchCount} mục theo dõi` : `Review ${watchCount} watch item${watchCount === 1 ? "" : "s"}`)
                : (isVietnamese ? "Mở evidence báo cáo" : "Open report evidence")}
            <ArrowRightIcon className="size-3.5" />
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
        <div className="v2-panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="v2-section-title">{isVietnamese ? "Điều cần chú ý" : "What needs attention"}</h2>
              <p className="v2-section-copy">{isVietnamese ? "Xếp theo tác động quyết định, không chỉ theo biến động metric." : "Ranked by decision impact, not by raw metric movement."}</p>
            </div>
            <Badge variant="outline">{attentionItems.length} {isVietnamese ? "tín hiệu" : "signals"}</Badge>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {attentionItems.map((item, index) => {
              const danger = item.severity === "danger";
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`grid w-full grid-cols-[24px_minmax(0,1fr)_20px] items-center gap-3 rounded-xl border px-3 py-4 text-left transition-colors hover:border-primary/45 ${danger ? "border-destructive/20 bg-destructive/10" : "border-transparent bg-secondary/55"}`}
                  onClick={() => onOpen("ads")}
                >
                  {danger ? <ShieldCheckIcon className="size-4 text-destructive" /> : index === 0 ? <AlertTriangleIcon className="size-4 text-warning" /> : <BarChart3Icon className="size-4 text-primary" />}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.titleText}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.detailText}</span>
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="v2-panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="v2-section-title">{isVietnamese ? "Báo cáo gần đây" : "Recent reports"}</h2>
              <p className="v2-section-copy">{isVietnamese ? "Tiếp tục từ evidence mới nhất." : "Continue from the latest evidence."}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {savedReports.length ? (
                <Button type="button" variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" onClick={() => setClearHistoryOpen(true)}>
                  <Trash2Icon data-icon="inline-start" />
                  {isVietnamese ? "Xóa lịch sử" : "Clear history"}
                </Button>
              ) : null}
              <Badge variant="outline">{savedReports.length || (report ? 1 : 0)} {isVietnamese ? "báo cáo" : "reports"}</Badge>
            </div>
          </div>

          {report ? (
            <div className="v2-subtle-panel mt-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BarChart3Icon className="size-4 text-primary" />
                  <div>
                    <div className="text-sm font-medium">{isVietnamese ? "Chẩn đoán hiệu quả" : "Performance diagnosis"}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(report.pulledAt).toLocaleString()}</div>
                  </div>
                </div>
                <Badge variant="success">{isVietnamese ? "Hoàn tất" : "Complete"}</Badge>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">{healthSummary?.summary[language] || report.packReason}</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <ReportMetric label={isVietnamese ? "Chi tiêu" : "Spend"} value={currency(report.totals.spend, report.account.currency || "VND")} />
                <ReportMetric label={report.selectedPack === "sales_roas" ? (isVietnamese ? "Mua hàng" : "Purchases") : (isVietnamese ? "Kết quả" : "Results")} value={compactNumber(report.selectedPack === "sales_roas" ? report.totals.purchases : report.totals.leads || report.totals.messages || report.totals.linkClicks)} />
                <ReportMetric label="ROAS" value={report.totals.roas.toFixed(1)} />
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-4 w-full" onClick={() => onOpen("ads")}>
                {isVietnamese ? "Mở báo cáo" : "Open report"}
              </Button>
              {restoredReportId ? <p className="mt-3 text-center text-[11px] text-success">{isVietnamese ? "Đã khôi phục từ lịch sử workspace" : "Restored from workspace history"}</p> : null}
            </div>
          ) : (
            <div className="v2-subtle-panel mt-4 flex min-h-56 flex-col items-center justify-center p-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <RefreshCwIcon className="size-5" />
              </span>
              <h3 className="mt-4 text-sm font-medium">{isVietnamese ? "Chưa có chẩn đoán" : "No diagnosis yet"}</h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{isVietnamese ? "Mở Performance để chọn phạm vi và kéo báo cáo đầu tiên." : "Open Performance to choose a scope and pull the first report."}</p>
              <Button type="button" size="sm" className="mt-4" onClick={() => onOpen("ads")}>
                {isVietnamese ? "Bắt đầu" : "Start analysis"}
              </Button>
            </div>
          )}

          {savedReports.length > 1 ? (
            <div className="mt-3 grid gap-2">
              {savedReports.slice(0, 3).map((snapshot) => (
                <button
                  key={snapshot.id}
                  type="button"
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-left text-xs hover:border-primary/45 hover:bg-secondary/45"
                  onClick={() => onRestoreReport(snapshot)}
                >
                  <span className="min-w-0"><strong className="block truncate">{snapshot.accountName}</strong><small className="text-muted-foreground">{snapshot.dateSince} – {snapshot.dateUntil}</small></span>
                  <span className="shrink-0 text-primary">{isVietnamese ? "Khôi phục" : "Restore"}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><CheckCircle2Icon className="size-3.5 text-success" />{isVietnamese ? "Meta source" : "Meta source"}</span>
              <span className="text-muted-foreground">{authenticated ? (isVietnamese ? "Đã kết nối" : "Connected") : (isVietnamese ? "Chờ kết nối" : "Awaiting")}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><CircleDollarSignIcon className="size-3.5 text-primary" />{isVietnamese ? "Quy tắc quyết định" : "Decision rules"}</span>
              <span className="text-muted-foreground">{report ? (isVietnamese ? "Đã cập nhật" : "Updated") : (isVietnamese ? "Mặc định" : "Default")}</span>
            </div>
          </div>

          <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{isVietnamese ? "Xóa lịch sử báo cáo?" : "Clear saved report history?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {isVietnamese
                    ? "Các snapshot đã lưu sẽ bị xóa khỏi tài khoản này. Báo cáo đang mở vẫn giữ nguyên cho đến khi bạn rời hoặc chạy phạm vi mới."
                    : "Saved snapshots will be removed from this account. The report currently open stays available until you leave it or run a new scope."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearingHistory}>{isVietnamese ? "Giữ lại" : "Keep history"}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={clearingHistory}
                  onClick={async () => {
                    setClearingHistory(true);
                    try {
                      if (await onClearReportHistory()) setClearHistoryOpen(false);
                    } finally {
                      setClearingHistory(false);
                    }
                  }}
                >
                  <Trash2Icon data-icon="inline-start" />
                  {clearingHistory ? (isVietnamese ? "Đang xóa..." : "Clearing...") : (isVietnamese ? "Xóa lịch sử" : "Clear history")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}

function ScopeMetric({ icon: Icon, label, value }: { icon: typeof DatabaseIcon; label: string; value: string }) {
  return (
    <div className="v2-subtle-panel min-w-0 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-2 truncate text-xs font-medium" title={value}>{value}</div>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function capabilityName(key: CapabilityStatus["key"]) {
  return {
    meta_analysis: "Meta performance",
    competitor_evidence: "Competitor evidence",
    tiktok_profiles: "TikTok profiles",
    tiktok_ad_library: "TikTok Ad Library",
    page_publishing: "Page publishing",
    ai_enhancement: "AI enhancement",
    cross_channel_intelligence: "Cross-channel intelligence",
    google_ads: "Google Ads",
    linkedin_ads: "LinkedIn Ads",
  }[key];
}

function capabilityStateDetail(state: CapabilityState, language: "en" | "vi") {
  const copy = {
    available: { en: "Available and ready for the next decision.", vi: "Sẵn sàng cho quyết định tiếp theo." },
    degraded: { en: "Running with a local fallback; review output before acting.", vi: "Đang dùng fallback local; cần xem lại trước khi hành động." },
    needs_connection: { en: "Connect the source before evidence can be verified.", vi: "Kết nối nguồn trước khi có thể xác minh evidence." },
    needs_setup: { en: "Provider setup is still required for this workspace.", vi: "Workspace này vẫn cần thiết lập provider." },
    paused: { en: "This capability is paused until its data path is available.", vi: "Capability đang tạm dừng đến khi data path sẵn sàng." },
    unknown: { en: "Status could not be verified in the current session.", vi: "Không thể xác minh trạng thái trong session hiện tại." },
  } as const;
  return copy[state][language];
}
