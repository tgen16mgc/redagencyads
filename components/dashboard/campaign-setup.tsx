"use client";

import {
  CalendarRangeIcon,
  CircleDollarSignIcon,
  MapPinIcon,
  PanelsTopLeftIcon,
  Settings2Icon,
  TargetIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { buildCampaignSetup } from "@/lib/campaign-setup";
import type { DashboardReport, InterfaceLanguage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function CampaignSetupTab({
  report,
  language,
}: {
  report: DashboardReport;
  language: InterfaceLanguage;
}) {
  const isVietnamese = language === "vi";
  const campaigns = buildCampaignSetup(report);
  const adSetCount = campaigns.reduce((sum, campaign) => sum + campaign.adsets.length, 0);
  const targetingCount = campaigns.reduce(
    (sum, campaign) => sum + campaign.adsets.filter((adset) => adset.targeting.ageRange !== "Not provided by Meta" || adset.targeting.locations.length || adset.targeting.audiences.length || adset.targeting.placements.length).length,
    0,
  );
  const currency = report.account.currency || "VND";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SetupStat label={isVietnamese ? "Campaign trong phạm vi" : "Campaigns in scope"} value={String(campaigns.length)} />
        <SetupStat label={isVietnamese ? "Ad set" : "Ad sets"} value={String(adSetCount)} />
        <SetupStat label={isVietnamese ? "Có dữ liệu targeting" : "Targeting available"} value={`${targetingCount}/${adSetCount}`} />
      </div>

      <div className="v2-panel overflow-hidden">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Settings2Icon className="size-5" /></span>
            <div>
              <h2 className="v2-section-title">{isVietnamese ? "Thiết lập campaign và ad set" : "Campaign and ad-set setup"}</h2>
              <p className="v2-section-copy">{isVietnamese ? "Kiểm tra mục tiêu, ngân sách, trạng thái và targeting Meta đang trả về cho phạm vi này." : "Inspect objective, budget, delivery status, and the targeting Meta returns for this scope."}</p>
            </div>
          </div>
        </div>

        {campaigns.length ? (
          <div className="divide-y divide-border">
            {campaigns.map((campaign, index) => (
              <details key={campaign.id} className="group" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 marker:hidden hover:bg-secondary/25 sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-semibold">{campaign.name}</strong>
                      <Badge variant={statusVariant(campaign.status)}>{statusLabel(campaign.status)}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{campaign.objective ? humanize(campaign.objective) : (isVietnamese ? "Mục tiêu chưa được Meta cung cấp" : "Objective not provided by Meta")}</span>
                      <span>{budgetLabel(campaign.dailyBudget, campaign.lifetimeBudget, currency, language)}</span>
                      <span>{campaign.adsets.length} {isVietnamese ? "ad set" : campaign.adsets.length === 1 ? "ad set" : "ad sets"}</span>
                    </div>
                  </div>
                  <span className="mt-1 text-xs font-medium text-primary group-open:hidden">{isVietnamese ? "Mở" : "Open"}</span>
                  <span className="mt-1 hidden text-xs font-medium text-muted-foreground group-open:inline">{isVietnamese ? "Thu gọn" : "Collapse"}</span>
                </summary>

                <div className="grid gap-3 bg-secondary/10 px-4 pb-5 sm:px-5 xl:grid-cols-2">
                  {campaign.adsets.length ? campaign.adsets.map((adset) => (
                    <article key={adset.id} className="min-w-0 rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold leading-5">{adset.name}</h3>
                          <p className="mt-1 text-[11px] text-muted-foreground">ID {adset.id}</p>
                        </div>
                        <Badge variant={statusVariant(adset.status)}>{statusLabel(adset.status)}</Badge>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <SetupField icon={CircleDollarSignIcon} label={isVietnamese ? "Ngân sách" : "Budget"} values={[budgetLabel(adset.dailyBudget, adset.lifetimeBudget, currency, language)]} />
                        <SetupField icon={TargetIcon} label={isVietnamese ? "Tối ưu hóa" : "Optimization"} values={[adset.optimizationGoal ? humanize(adset.optimizationGoal) : missing(language)]} />
                        <SetupField icon={MapPinIcon} label={isVietnamese ? "Vị trí" : "Location"} values={withMissing(adset.targeting.locations.map((value) => localizeTargeting(value, language)), language)} />
                        <SetupField icon={UsersRoundIcon} label={isVietnamese ? "Tuổi và giới tính" : "Age and gender"} values={[adset.targeting.ageRange, ...adset.targeting.genders].map((value) => localizeTargeting(value, language))} />
                        <SetupField icon={PanelsTopLeftIcon} label={isVietnamese ? "Vị trí hiển thị" : "Placements"} values={withMissing(adset.targeting.placements.map(humanize), language)} />
                        <SetupField icon={TargetIcon} label={isVietnamese ? "Đối tượng / sở thích" : "Audience signals"} values={adset.targeting.audiences.length ? adset.targeting.audiences.map((value) => localizeTargeting(value, language)) : [isVietnamese ? "Broad / không giới hạn thêm" : "Broad / no additional restriction"]} />
                      </div>

                      <DeliveryDetails billingEvent={adset.billingEvent} bidStrategy={adset.bidStrategy} startTime={adset.startTime} endTime={adset.endTime} language={language} />
                    </article>
                  )) : (
                    <div className="col-span-full rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                      {isVietnamese ? "Meta chưa trả về cấu hình ad set cho campaign này." : "Meta did not return ad-set configuration for this campaign."}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {isVietnamese ? "Chưa có campaign trong phạm vi report này." : "No campaigns are available in this report scope."}
          </div>
        )}
      </div>
    </div>
  );
}

function SetupStat({ label, value }: { label: string; value: string }) {
  return <div className="v2-subtle-panel p-4"><div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</div><div className="mt-2 text-xl font-semibold tabular-nums">{value}</div></div>;
}

function SetupField({ icon: Icon, label, values }: { icon: LucideIcon; label: string; values: string[] }) {
  return (
    <div className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] gap-2.5">
      <Icon className="mt-0.5 size-4 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{label}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className="max-w-full break-words rounded-md bg-secondary px-2 py-1 text-[11px] leading-4 text-foreground">{value}</span>)}</div>
      </div>
    </div>
  );
}

function DeliveryDetails({ billingEvent, bidStrategy, startTime, endTime, language }: { billingEvent?: string; bidStrategy?: string; startTime?: string; endTime?: string; language: InterfaceLanguage }) {
  const values = [
    billingEvent ? `${language === "vi" ? "Tính phí" : "Billing"}: ${humanize(billingEvent)}` : null,
    bidStrategy ? `${language === "vi" ? "Giá thầu" : "Bid"}: ${humanize(bidStrategy)}` : null,
    startTime ? `${language === "vi" ? "Bắt đầu" : "Starts"}: ${formatDate(startTime)}` : null,
    endTime ? `${language === "vi" ? "Kết thúc" : "Ends"}: ${formatDate(endTime)}` : null,
  ].filter((value): value is string => Boolean(value));
  if (!values.length) return null;
  return <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[10px] text-muted-foreground"><CalendarRangeIcon className="size-3.5" />{values.map((value) => <span key={value}>{value}</span>)}</div>;
}

function withMissing(values: string[], language: InterfaceLanguage) {
  return values.length ? values : [missing(language)];
}

function missing(language: InterfaceLanguage) {
  return language === "vi" ? "Meta chưa cung cấp" : "Not provided by Meta";
}

function localizeTargeting(value: string, language: InterfaceLanguage) {
  if (language !== "vi") return value;
  if (value === "Not provided by Meta") return "Meta chưa cung cấp";
  if (value === "All genders / not restricted") return "Tất cả giới tính / không giới hạn";
  if (value === "Men") return "Nam";
  if (value === "Women") return "Nữ";
  if (value.startsWith("Excluded: ")) return `Loại trừ: ${value.slice(10)}`;
  if (value.startsWith("People: ")) return `Loại vị trí: ${humanize(value.slice(8))}`;
  return value;
}

function statusVariant(status: string): "success" | "outline" | "secondary" {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") return "success";
  if (normalized.includes("PAUSED") || normalized.includes("DISABLED")) return "outline";
  return "secondary";
}

function statusLabel(status: string) {
  return humanize(status || "UNKNOWN");
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function budgetLabel(daily: number, lifetime: number, currency: string, language: InterfaceLanguage) {
  if (daily > 0) return `${money(daily, currency)} / ${language === "vi" ? "ngày" : "day"}`;
  if (lifetime > 0) return `${money(lifetime, currency)} ${language === "vi" ? "trọn đời" : "lifetime"}`;
  return language === "vi" ? "Ngân sách ở cấp campaign hoặc chưa được Meta cung cấp" : "Campaign-level budget or not provided by Meta";
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
