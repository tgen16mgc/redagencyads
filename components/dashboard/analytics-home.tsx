"use client";

import type { ComponentProps } from "react";
import type { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { Button } from "@/components/ui/button";

export function AnalyticsHome({ authenticated, language, report, savedReports, onEditScope, onOpenPerformance, onRestoreReport }: ComponentProps<typeof WorkspaceOverview>) {
  const vi = language === "vi";
  return <div className="grid gap-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div><h1 className="text-2xl font-semibold tracking-tight">{vi ? "Báo cáo Meta Ads" : "Meta Ads reports"}</h1><p className="mt-2 text-sm text-muted-foreground">{vi ? "Chọn tài khoản và khoảng ngày để xem hiệu quả quảng cáo." : "Choose an account and date range to review advertising performance."}</p></div>
      <Button onClick={onEditScope}>{authenticated ? (vi ? "Tạo báo cáo" : "New report") : (vi ? "Kết nối Meta" : "Connect Meta")}</Button>
    </header>
    {report ? <section className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5"><div><h2 className="font-medium">{report.account.name}</h2><p className="mt-1 text-xs text-muted-foreground">{report.dateRange.since} – {report.dateRange.until} · {report.source === "sample" ? "Sample data" : "Meta Marketing API"}</p></div><Button variant="outline" onClick={() => onOpenPerformance("overview")}>{vi ? "Mở báo cáo" : "Open report"}</Button></section> : <p className="py-8 text-sm text-muted-foreground">{vi ? "Chưa tải báo cáo. Kết nối Meta và chọn phạm vi để bắt đầu." : "No report loaded. Connect Meta and choose a scope to get started."}</p>}
    <section><h2 className="mb-3 text-sm font-semibold">{vi ? "Báo cáo đã lưu" : "Saved reports"}</h2>{savedReports.length ? <div className="divide-y divide-border border-y border-border">{savedReports.map((snapshot) => <button key={snapshot.id} type="button" onClick={() => onRestoreReport(snapshot)} className="flex w-full flex-wrap items-center justify-between gap-2 px-2 py-4 text-left hover:bg-muted/50"><span className="text-sm font-medium">{snapshot.accountName}</span><span className="text-xs text-muted-foreground">{snapshot.dateSince} – {snapshot.dateUntil}{snapshot.report.source === "sample" ? " · Sample" : ""}</span></button>)}</div> : <p className="text-sm text-muted-foreground">{vi ? "Báo cáo đã lưu sẽ xuất hiện ở đây." : "Saved reports will appear here."}</p>}</section>
  </div>;
}
