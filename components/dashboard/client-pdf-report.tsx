"use client";

import * as React from "react";
import { buildClientReportViewModel, type ClientReportAction, type ClientReportKpi, type ClientReportTable, type ClientReportViewModel } from "@/lib/client-report";
import { formatMetric } from "@/lib/metrics";
import type { AiInsightTable, CompareMode, DashboardReport, InterfaceLanguage, KpiCard, NormalizedRow, Verdict } from "@/lib/types";

export function ClientPdfReport({
  report,
  previousReport,
  compareMode,
  verdict,
  insights,
  language,
  kpis,
}: {
  report: DashboardReport;
  previousReport?: DashboardReport | null;
  compareMode: CompareMode;
  verdict?: Verdict | null;
  insights?: AiInsightTable | null;
  language: InterfaceLanguage;
  kpis: KpiCard[];
}) {
  const model = React.useMemo(
    () => buildClientReportViewModel({ report, previousReport, compareMode, verdict, insights, language, kpis }),
    [compareMode, insights, kpis, language, previousReport, report, verdict],
  );

  return (
    <section className="client-pdf-report" data-client-pdf-report aria-label={model.copy.title}>
      <CoverPage model={model} />
      <ExecutivePage model={model} />
      <PerformancePage model={model} />
      <RecommendationPage model={model} />
      <AppendixChartsPage model={model} />
      <AppendixTablesPage model={model} />
      <AppendixDiagnosticsPage model={model} />
    </section>
  );
}

function CoverPage({ model }: { model: ClientReportViewModel }) {
  return (
    <ReportPage model={model} section="Cover" page="Cover" cover>
      <div className="client-report-cover-main">
        <div>
          <div className="client-report-brand-lockup">
            <img src="/red-agency-logo.png" alt="Red Agency" />
            <span>Red Agency</span>
          </div>
          <h1>{model.copy.title}</h1>
          <p>{model.copy.subtitle}</p>
          <div className="client-report-gradient" />
        </div>
        <div className="client-report-meta-grid">
          <MetaCard label={model.language === "vi" ? "Khách hàng" : "Client"} value={model.accountName} />
          <MetaCard label={model.language === "vi" ? "Kỳ báo cáo" : "Period"} value={model.dateRangeLabel} />
          <MetaCard label={model.copy.verdictLabel} value={model.healthLabel} />
          <MetaCard label={model.language === "vi" ? "Ngày tạo" : "Generated"} value={model.generatedLabel} />
          <MetaCard label={model.language === "vi" ? "Chuẩn bị bởi" : "Prepared by"} value="Red Agency" />
          <MetaCard label={model.language === "vi" ? "Nguồn" : "Source"} value={model.copy.source} />
        </div>
      </div>
    </ReportPage>
  );
}

function ExecutivePage({ model }: { model: ClientReportViewModel }) {
  return (
    <ReportPage model={model} section={model.copy.executiveSummary} page="Page 2" footnote={model.copy.footnoteSource}>
      <PageTitle kicker={model.copy.executiveSummary} title={model.language === "vi" ? "Hiệu quả tổng quan" : "Performance at a glance"} pill={model.healthLabel} />
      <KpiGrid kpis={model.kpis} />
      <div className="client-report-narrative">
        <h3>{model.copy.verdictLabel}</h3>
        <p>{model.verdictText}</p>
      </div>
      <div className="client-report-three-col">
        <InsightList title={model.copy.wins} items={model.wins} />
        <InsightList title={model.copy.risks} items={model.risks} />
        <ActionSummary title={model.copy.nextMoves} actions={model.actions.slice(0, 2)} />
      </div>
      <div className="client-report-narrative compact">
        <h3>{model.language === "vi" ? "Tóm tắt insight" : "Insight summary"}</h3>
        <p>{model.insightSummary}</p>
      </div>
    </ReportPage>
  );
}

function PerformancePage({ model }: { model: ClientReportViewModel }) {
  return (
    <ReportPage model={model} section={model.copy.performanceStory} page="Page 3" footnote={model.copy.footnoteComparison}>
      <PageTitle kicker={model.copy.performanceStory} title={model.language === "vi" ? "Điều gì thay đổi và vì sao" : "What changed and why"} pill={model.language === "vi" ? "Biểu đồ + driver" : "Charts + drivers"} />
      <div className="client-report-chart-grid">
        <ChartCard title={model.language === "vi" ? "Spend và kết quả chính" : "Spend vs primary results"} description={model.language === "vi" ? "Xu hướng spend theo kết quả chính trong kỳ." : "Daily spend shown against the primary result trend."}>
          <TrendChart rows={model.dailyTrend} />
        </ChartCard>
        <ChartCard title={model.language === "vi" ? "Campaign dẫn dắt" : "Campaign drivers"} description={model.language === "vi" ? "Những dòng tạo nhiều tín hiệu nhất." : "Rows contributing the strongest signal."}>
          <BarList rows={model.topCampaigns.slice(0, 5)} currency={model.currency} metric="spend" />
        </ChartCard>
      </div>
      <div className="client-report-three-col">
        <MiniTable title={model.language === "vi" ? "Top campaign" : "Top campaigns"} rows={model.topCampaigns.slice(0, 3)} currency={model.currency} />
        <MiniTable title={model.language === "vi" ? "Top ad set" : "Top ad sets"} rows={model.topAdsets.slice(0, 3)} currency={model.currency} />
        <MiniTable title={model.language === "vi" ? "Khu vực" : "Regions"} rows={model.breakdowns.regions.slice(0, 3)} currency={model.currency} />
      </div>
    </ReportPage>
  );
}

function RecommendationPage({ model }: { model: ClientReportViewModel }) {
  return (
    <ReportPage model={model} section={model.copy.recommendations} page="Page 4" footnote={model.copy.footnoteRecommendations}>
      <PageTitle kicker={model.copy.recommendations} title={model.language === "vi" ? "Red Agency khuyến nghị gì tiếp theo" : "What Red Agency recommends next"} pill={model.language === "vi" ? "Theo thứ tự ưu tiên" : "Priority ordered"} />
      <div className="client-report-actions">
        {model.actions.map((action, index) => (
          <ActionCard key={`${action.title}-${index}`} action={action} index={index + 1} />
        ))}
      </div>
      <div className="client-report-appendix-grid two-by-two">
        <InfoTile title={model.language === "vi" ? "Người phụ trách" : "Owner"} text={model.language === "vi" ? "Media buyer điều chỉnh sau khi khách hàng duyệt." : "Media buyer adjusts budget after client approval."} />
        <InfoTile title={model.language === "vi" ? "Thời điểm" : "Timing"} text={model.language === "vi" ? "Áp dụng trong 48 giờ, rà soát sau 3 ngày." : "Apply within 48 hours, review after 3 days."} />
        <InfoTile title={model.language === "vi" ? "Guardrail" : "Guardrail"} text={model.language === "vi" ? "Dừng scale nếu CPA vượt mục tiêu đã thống nhất." : "Pause scale if CPA rises above the agreed target."} />
        <InfoTile title={model.language === "vi" ? "Bằng chứng" : "Evidence"} text={model.language === "vi" ? "Xem phụ lục để kiểm tra biểu đồ và bảng dòng." : "See appendix charts and row-level tables."} />
      </div>
    </ReportPage>
  );
}

function AppendixChartsPage({ model }: { model: ClientReportViewModel }) {
  return (
    <ReportPage model={model} section={model.copy.appendixCharts} page="Appendix A · Page 5" footnote={model.copy.footnoteSource}>
      <PageTitle kicker="Appendix A" title={model.language === "vi" ? "Biểu đồ và breakdown" : "Charts and breakdowns"} pill={model.language === "vi" ? "Đầy đủ" : "Complete"} />
      <div className="client-report-appendix-grid">
        <ChartCard title={model.language === "vi" ? "Platform" : "Platform breakdown"} description={model.language === "vi" ? "Spend theo platform." : "Spend by platform."}>
          <BarList rows={model.breakdowns.platforms} currency={model.currency} metric="spend" />
        </ChartCard>
        <ChartCard title={model.language === "vi" ? "Địa lý" : "Geography"} description={model.language === "vi" ? "Spend theo khu vực." : "Spend by region."}>
          <BarList rows={model.breakdowns.regions} currency={model.currency} metric="spend" />
        </ChartCard>
        <ChartCard title={model.language === "vi" ? "Tuổi / giới tính" : "Age / gender"} description={model.language === "vi" ? "Breakdown nhân khẩu học." : "Demographic breakdown."}>
          <BarList rows={model.breakdowns.ageGender} currency={model.currency} metric="spend" />
        </ChartCard>
        <ChartCard title={model.language === "vi" ? "Ad set" : "Ad set breakdown"} description={model.language === "vi" ? "Ad set tạo tín hiệu chính." : "Ad sets driving the selected scope."}>
          <BarList rows={model.topAdsets} currency={model.currency} metric="spend" />
        </ChartCard>
      </div>
    </ReportPage>
  );
}

function AppendixTablesPage({ model }: { model: ClientReportViewModel }) {
  return (
    <ReportPage model={model} section={model.copy.appendixTables} page="Appendix B · Page 6" footnote={model.language === "vi" ? "Bảng dài có thể tiếp tục qua trang tiếp theo khi lưu PDF." : "Long tables may continue across pages when saved to PDF."}>
      <PageTitle kicker="Appendix B" title={model.language === "vi" ? "Bảng hiệu quả" : "Performance tables"} pill={model.language === "vi" ? "Không ẩn tab" : "No hidden tabs"} />
      <div className="client-report-table-stack">
        {model.tables.map((table) => (
          <ReportDataTable key={table.title} table={table} currency={model.currency} language={model.language} />
        ))}
      </div>
    </ReportPage>
  );
}

function AppendixDiagnosticsPage({ model }: { model: ClientReportViewModel }) {
  return (
    <ReportPage model={model} section={model.copy.appendixDiagnostics} page="Appendix C · Page 7" footnote={model.language === "vi" ? "Creative preview dùng metadata in được nếu iframe không an toàn cho PDF." : "Creative previews use printable metadata when embedded previews are not PDF-safe."}>
      <PageTitle kicker="Appendix C" title={model.language === "vi" ? "Chẩn đoán và creative" : "Diagnostics and creative detail"} pill={model.language === "vi" ? "Print-safe" : "Print-safe"} />
      <div className="client-report-appendix-grid two-by-two">
        {model.diagnostics.map((check) => (
          <InfoTile key={check.id} title={`${check.label} · ${check.status}`} text={check.detail} />
        ))}
      </div>
      <div className="client-report-section-block">
        <h3>{model.language === "vi" ? "Ad set và creative đang chạy" : "Running ad set and creative detail"}</h3>
        <div className="client-report-creative-grid">
          {model.creativeDetails.length ? model.creativeDetails.map((creative) => (
            <div className="client-report-creative-card" key={creative.name}>
              <b>{creative.name}</b>
              <span>{creative.campaignName}</span>
              <span>{creative.status} · {creative.adCount} ads</span>
              <ul>
                {creative.ads.map((ad) => <li key={ad}>{ad}</li>)}
              </ul>
            </div>
          )) : <InfoTile title={model.language === "vi" ? "Không có preview" : "No previews"} text={model.language === "vi" ? "Không có creative preview trong phạm vi hiện tại." : "No creative previews are available in the current scope."} />}
        </div>
      </div>
    </ReportPage>
  );
}

function ReportPage({ model, section, page, footnote, cover = false, children }: { model: ClientReportViewModel; section: string; page: string; footnote?: string; cover?: boolean; children: React.ReactNode }) {
  return (
    <article className={`client-report-page${cover ? " is-cover" : ""}`}>
      <header className="client-report-header">
        <span>{section}</span>
        <span>{model.dateRangeLabel}</span>
      </header>
      <main className="client-report-page-body">{children}</main>
      {footnote ? <div className="client-report-footnote">{footnote}</div> : null}
      <footer className="client-report-footer">
        <span>Red Agency</span>
        <span>{page}</span>
        <span>{model.accountName}</span>
      </footer>
    </article>
  );
}

function PageTitle({ kicker, title, pill }: { kicker: string; title: string; pill: string }) {
  return (
    <div className="client-report-title-row">
      <div>
        <div className="client-report-kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      <span>{pill}</span>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="client-report-meta-card">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function KpiGrid({ kpis }: { kpis: ClientReportKpi[] }) {
  return (
    <div className="client-report-kpi-grid">
      {kpis.map((kpi) => (
        <div className={`client-report-kpi is-${kpi.movement}`} key={kpi.key}>
          <span>{kpi.label}</span>
          <b>{kpi.value}</b>
          {kpi.delta ? <small>{kpi.delta}</small> : null}
        </div>
      ))}
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="client-report-mini-panel">
      <b>{title}</b>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function ActionSummary({ title, actions }: { title: string; actions: ClientReportAction[] }) {
  return (
    <div className="client-report-mini-panel">
      <b>{title}</b>
      <ul>
        {actions.map((action) => <li key={action.title}>{action.title}</li>)}
      </ul>
    </div>
  );
}

function ActionCard({ action, index }: { action: ClientReportAction; index: number }) {
  return (
    <div className="client-report-action-card">
      <span>{index}</span>
      <div>
        <b>{action.title}</b>
        <p>{action.detail}</p>
      </div>
    </div>
  );
}

function InfoTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="client-report-info-tile">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="client-report-chart-card">
      <div className="client-report-chart-header">
        <b>{title}</b>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

function TrendChart({ rows }: { rows: ClientReportViewModel["dailyTrend"] }) {
  const chartRows = rows.length ? rows : [{ label: "—", spend: 0, primary: 0 }];
  const maxSpend = Math.max(...chartRows.map((row) => row.spend), 1);
  const maxPrimary = Math.max(...chartRows.map((row) => row.primary), 1);
  const spendPoints = chartRows.map((row, index) => `${pointX(index, chartRows.length)},${128 - (row.spend / maxSpend) * 92}`).join(" ");
  const primaryPoints = chartRows.map((row, index) => `${pointX(index, chartRows.length)},${128 - (row.primary / maxPrimary) * 92}`).join(" ");
  const areaPoints = `${spendPoints} ${pointX(chartRows.length - 1, chartRows.length)},132 24,132`;

  return (
    <svg className="client-report-chart" viewBox="0 0 520 150" role="img" aria-label="Daily performance trend">
      <path d={`M ${areaPoints} Z`} fill="#6a4cf5" opacity="0.14" />
      <polyline points={spendPoints} fill="none" stroke="#6a4cf5" strokeWidth="4" strokeLinecap="round" />
      <polyline points={primaryPoints} fill="none" stroke="#ff7a3d" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 7" />
      <line x1="24" y1="132" x2="496" y2="132" stroke="#eaecf0" />
    </svg>
  );
}

function pointX(index: number, length: number) {
  if (length <= 1) return 24;
  return 24 + (index / (length - 1)) * 472;
}

function BarList({ rows, currency, metric }: { rows: NormalizedRow[]; currency: string; metric: keyof Pick<NormalizedRow, "spend" | "leads" | "messages" | "purchases" | "linkClicks"> }) {
  const max = Math.max(...rows.map((row) => Number(row[metric] || 0)), 1);
  return (
    <div className="client-report-bar-list">
      {rows.length ? rows.slice(0, 6).map((row) => {
        const value = Number(row[metric] || 0);
        return (
          <div className="client-report-bar-row" key={`${row.id}-${row.name}`}>
            <div><span>{reportRowLabel(row)}</span><b>{metric === "spend" ? formatMetric(value, "currency", currency) : formatMetric(value, "number", currency)}</b></div>
            <i><em style={{ width: `${Math.max(3, (value / max) * 100)}%` }} /></i>
          </div>
        );
      }) : <div className="client-report-empty-row">No rows</div>}
    </div>
  );
}

function MiniTable({ title, rows, currency }: { title: string; rows: NormalizedRow[]; currency: string }) {
  return (
    <div className="client-report-mini-table">
      <b>{title}</b>
      {rows.map((row) => (
        <div key={`${title}-${row.id}-${row.name}`}>
          <span>{reportRowLabel(row)}</span>
          <small>{formatMetric(row.spend, "currency", currency)}</small>
        </div>
      ))}
    </div>
  );
}

function ReportDataTable({ table, currency, language }: { table: ClientReportTable; currency: string; language: InterfaceLanguage }) {
  return (
    <section className="client-report-data-section">
      <h3>{table.title}</h3>
      <table className="client-report-data-table">
        <thead>
          <tr>
            <th>{language === "vi" ? "Tên" : "Name"}</th>
            <th>{language === "vi" ? "Chi tiêu" : "Spend"}</th>
            <th>{language === "vi" ? "Kết quả" : "Results"}</th>
            <th>{language === "vi" ? "CPA" : "CPA"}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 12).map((row) => (
            <tr key={`${table.title}-${row.id}-${row.name}-${row.date || ""}`}>
              <td>{reportRowLabel(row)}</td>
              <td>{formatMetric(row.spend, "currency", currency)}</td>
              <td>{formatMetric(primaryResult(row), "number", currency)}</td>
              <td>{formatMetric(primaryCost(row), "currency", currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function reportRowLabel(row: NormalizedRow) {
  if (row.level === "daily") return row.date || row.name;
  if (row.platform) return row.platform;
  if (row.placement) return row.placement;
  if (row.region) return row.region;
  if (row.country) return row.country;
  if (row.age && row.gender) return `${row.age} ${row.gender}`;
  return row.name;
}

function primaryResult(row: NormalizedRow) {
  return row.leads || row.messages || row.purchases || row.linkClicks || row.clicks || row.impressions;
}

function primaryCost(row: NormalizedRow) {
  return row.cpl || row.costPerMessage || row.cpaPurchase || row.cpc || row.cpm;
}
