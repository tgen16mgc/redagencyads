"use client";

import * as React from "react";
import { Button, Card, Chip, Disclosure, SearchField, Tooltip } from "@heroui/react";
import {
  CalendarRangeIcon,
  CircleDollarSignIcon,
  MapPinIcon,
  PanelsTopLeftIcon,
  Settings2Icon,
  SparklesIcon,
  TargetIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import {
  buildCampaignSetup,
  filterCampaignSetup,
  statusChipStyle,
  type AdSetSetup,
  type CampaignSetup,
} from "@/lib/campaign-setup";
import type { DashboardReport, InterfaceLanguage } from "@/lib/types";

export function CampaignSetupTab({
  report,
  language,
}: {
  report: DashboardReport;
  language: InterfaceLanguage;
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const isVietnamese = language === "vi";
  const campaigns = buildCampaignSetup(report);
  const visibleCampaigns = filterCampaignSetup(campaigns, searchQuery);
  const adSetCount = campaigns.reduce((sum, campaign) => sum + campaign.adsets.length, 0);
  const targetingCount = campaigns.reduce(
    (sum, campaign) => sum + campaign.adsets.filter((adset) => adset.targeting.ageRange !== "Not provided by Meta" || adset.targeting.locations.length || adset.targeting.audiences.length || adset.targeting.placements.length).length,
    0,
  );
  const currency = report.account.currency || "VND";

  return (
    <div className="campaign-setup-surface flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SetupStat label={isVietnamese ? "Campaign trong phạm vi" : "Campaigns in scope"} value={String(campaigns.length)} />
        <SetupStat label={isVietnamese ? "Ad set" : "Ad sets"} value={String(adSetCount)} />
        <SetupStat label={isVietnamese ? "Có dữ liệu targeting" : "Targeting available"} value={`${targetingCount}/${adSetCount}`} />
      </div>

      <Card className="gap-0 overflow-hidden border border-border bg-surface p-0 shadow-none" variant="default">
        <Card.Header className="flex-col items-stretch gap-4 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Settings2Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <Card.Title className="v2-section-title">{isVietnamese ? "Thiết lập campaign và ad set" : "Campaign and ad-set setup"}</Card.Title>
              <Card.Description className="v2-section-copy">
                {isVietnamese
                  ? "Chế độ gọn là mặc định. Chọn một ad set để xem đầy đủ ngân sách, delivery và targeting Meta đang trả về."
                  : "Compact mode is the default. Select an ad set to inspect the full budget, delivery, and targeting returned by Meta."}
              </Card.Description>
            </div>
          </div>
          <SearchField
            aria-label={isVietnamese ? "Tìm campaign hoặc ad set" : "Search campaigns or ad sets"}
            className="w-full shrink-0 lg:max-w-sm"
            name="campaign-setup-search"
            value={searchQuery}
            variant="secondary"
            onChange={setSearchQuery}
          >
            <SearchField.Group className="w-full">
              <SearchField.SearchIcon />
              <SearchField.Input
                className="w-full"
                placeholder={isVietnamese ? "Tìm campaign hoặc ad set..." : "Search campaign or ad set..."}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </Card.Header>

        <Card.Content className="gap-0 p-0">
          {visibleCampaigns.length ? (
            <div className="divide-y divide-border">
              {visibleCampaigns.map((campaign) => (
                <CampaignGroup key={campaign.id} campaign={campaign} currency={currency} language={language} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted">
              {campaigns.length
                ? (isVietnamese ? "Không tìm thấy campaign hoặc ad set phù hợp." : "No campaign or ad set matches this search.")
                : (isVietnamese ? "Chưa có campaign trong phạm vi report này." : "No campaigns are available in this report scope.")}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

function CampaignGroup({
  campaign,
  currency,
  language,
}: {
  campaign: CampaignSetup;
  currency: string;
  language: InterfaceLanguage;
}) {
  const isVietnamese = language === "vi";
  return (
    <section>
      <div className="flex flex-col gap-3 bg-surface-secondary/55 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-foreground">{campaign.name}</h2>
            <StatusChip status={campaign.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>{campaign.objective ? humanize(campaign.objective) : (isVietnamese ? "Mục tiêu chưa được Meta cung cấp" : "Objective not provided by Meta")}</span>
            <span>{budgetLabel(campaign.dailyBudget, campaign.lifetimeBudget, currency, language)}</span>
          </div>
        </div>
        <Chip className="w-fit shrink-0" size="sm" variant="soft">
          <Chip.Label>{campaign.adsets.length} {isVietnamese ? "ad set" : campaign.adsets.length === 1 ? "ad set" : "ad sets"}</Chip.Label>
        </Chip>
      </div>

      <div className="grid gap-2 p-3 sm:p-4">
        {campaign.adsets.length ? campaign.adsets.map((adset) => (
          <AdSetDisclosure key={adset.id} adset={adset} currency={currency} language={language} />
        )) : (
          <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
            {isVietnamese ? "Meta chưa trả về cấu hình ad set cho campaign này." : "Meta did not return ad-set configuration for this campaign."}
          </div>
        )}
      </div>
    </section>
  );
}

function AdSetDisclosure({
  adset,
  currency,
  language,
}: {
  adset: AdSetSetup;
  currency: string;
  language: InterfaceLanguage;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isVietnamese = language === "vi";
  const firstLocation = adset.targeting.locations[0]
    ? localizeTargeting(adset.targeting.locations[0], language)
    : missing(language);

  return (
    <Disclosure
      className="overflow-hidden rounded-2xl border border-border bg-surface"
      isExpanded={isExpanded}
      onExpandedChange={setIsExpanded}
    >
      <Disclosure.Heading>
        <Button
          fullWidth
          className="h-auto min-h-20 justify-between rounded-2xl px-3.5 py-3 text-left sm:px-4"
          slot="trigger"
          variant="ghost"
        >
          <span className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <TargetIcon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{adset.name}</span>
                <StatusChip status={adset.status} />
                {adset.targeting.advantagePlus ? <AdvantagePlusStatus language={language} /> : null}
              </span>
              <span className="mt-1 block truncate text-[11px] text-muted">ID {adset.id}</span>
              <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                <span>{adset.targeting.ageRange}</span>
                <span className="max-w-full truncate">{firstLocation}</span>
                <span>{budgetLabel(adset.dailyBudget, adset.lifetimeBudget, currency, language)}</span>
              </span>
            </span>
          </span>
          <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-muted">
            <span className="hidden sm:inline">{isExpanded ? (isVietnamese ? "Thu gọn" : "Collapse") : (isVietnamese ? "Xem thiết lập" : "View setup")}</span>
            <Disclosure.Indicator />
          </span>
        </Button>
      </Disclosure.Heading>

      <Disclosure.Content>
        <Disclosure.Body className="border-t border-border bg-surface-secondary/35 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SetupField icon={CircleDollarSignIcon} label={isVietnamese ? "Ngân sách" : "Budget"} values={[budgetLabel(adset.dailyBudget, adset.lifetimeBudget, currency, language)]} />
            <SetupField icon={TargetIcon} label={isVietnamese ? "Tối ưu hóa" : "Optimization"} values={[adset.optimizationGoal ? humanize(adset.optimizationGoal) : missing(language)]} />
            <SetupField icon={MapPinIcon} label={isVietnamese ? "Vị trí" : "Location"} values={withMissing(adset.targeting.locations.map((value) => localizeTargeting(value, language)), language)} />
            <SetupField icon={UsersRoundIcon} label={isVietnamese ? "Tuổi và giới tính" : "Age and gender"} values={[adset.targeting.ageRange, ...adset.targeting.genders].map((value) => localizeTargeting(value, language))} />
            <SetupField icon={PanelsTopLeftIcon} label={isVietnamese ? "Vị trí hiển thị" : "Placements"} values={withMissing(adset.targeting.placements.map(humanize), language)} />
            <SetupField icon={TargetIcon} label={isVietnamese ? "Đối tượng / sở thích" : "Audience signals"} values={adset.targeting.audiences.length ? adset.targeting.audiences.map((value) => localizeTargeting(value, language)) : [isVietnamese ? "Broad / không giới hạn thêm" : "Broad / no additional restriction"]} />
          </div>

          <DeliveryDetails billingEvent={adset.billingEvent} bidStrategy={adset.bidStrategy} startTime={adset.startTime} endTime={adset.endTime} language={language} />
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

function SetupStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-0 border border-border bg-surface-secondary p-4 shadow-none" variant="secondary">
      <Card.Content className="gap-0 p-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">{label}</div>
        <div className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</div>
      </Card.Content>
    </Card>
  );
}

function SetupField({ icon: Icon, label, values }: { icon: LucideIcon; label: string; values: string[] }) {
  return (
    <div className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] gap-2.5">
      <Icon className="mt-0.5 size-4 text-accent" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted">{label}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Chip key={value} className="max-w-full" size="sm" variant="soft">
              <Chip.Label className="break-words whitespace-normal">{value}</Chip.Label>
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const { color, variant } = statusChipStyle(status);
  return (
    <Chip color={color} size="sm" variant={variant}>
      <Chip.Label>{statusLabel(status)}</Chip.Label>
    </Chip>
  );
}

function AdvantagePlusStatus({ language }: { language: InterfaceLanguage }) {
  const isVietnamese = language === "vi";
  const title = isVietnamese ? "Advantage+ audience đang bật" : "Advantage+ audience is on";
  const description = isVietnamese
    ? "Meta có thể mở rộng ngoài các gợi ý về tuổi, giới tính và sở thích khi dự đoán kết quả tốt hơn. Vị trí, tuổi tối thiểu, ngôn ngữ và tệp loại trừ vẫn là giới hạn kiểm soát."
    : "Meta may expand beyond age, gender, and interest suggestions when it predicts better results. Location, minimum age, language, and audience exclusions remain controls.";
  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger aria-description={description} aria-label={title} role="status" tabIndex={-1}>
        <Chip className="cursor-help" color="accent" size="sm" variant="soft">
          <SparklesIcon className="size-3" aria-hidden="true" />
          <Chip.Label>Advantage+ on</Chip.Label>
        </Chip>
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-72 rounded-xl border border-white/10 bg-overlay px-3 py-2 text-xs leading-5 text-white shadow-lg" placement="top" showArrow>
        <Tooltip.Arrow />
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-white/75">{description}</p>
      </Tooltip.Content>
    </Tooltip>
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
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-[10px] text-muted">
      <CalendarRangeIcon className="size-3.5" aria-hidden="true" />
      {values.map((value) => <span key={value}>{value}</span>)}
    </div>
  );
}

function withMissing(values: string[], language: InterfaceLanguage) {
  return values.length ? values : [missing(language)];
}

function missing(language: InterfaceLanguage) {
  return language === "vi" ? "Meta chưa cung cấp" : "Not provided by Meta";
}

function localizeTargeting(value: string, language: InterfaceLanguage) {
  if (value.startsWith("People: ")) return peopleLocationLabel(value.slice(8), language);
  if (language !== "vi") return value;
  if (value === "Not provided by Meta") return "Meta chưa cung cấp";
  if (value === "All genders / not restricted") return "Tất cả giới tính / không giới hạn";
  if (value === "Men") return "Nam";
  if (value === "Women") return "Nữ";
  if (value.startsWith("Excluded: ")) return `Loại trừ: ${value.slice(10)}`;
  return value;
}

function peopleLocationLabel(value: string, language: InterfaceLanguage) {
  const normalized = value.toLocaleLowerCase();
  if (language === "vi") {
    if (normalized === "home") return "Người sống tại vị trí này";
    if (normalized === "recent") return "Người gần đây ở vị trí này";
    if (normalized === "frequently_in") return "Người thường xuyên ở vị trí này";
    return `Loại vị trí: ${humanize(value)}`;
  }
  if (normalized === "home") return "People living in this location";
  if (normalized === "recent") return "People recently in this location";
  if (normalized === "frequently_in") return "People frequently in this location";
  return `People: ${humanize(value)}`;
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
