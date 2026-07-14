"use client";

import {
  ActivityIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  SearchIcon,
  ShieldAlertIcon,
  SparklesIcon,
  WaypointsIcon,
} from "lucide-react";
import type { CapabilityKey, CapabilityState, CapabilityStatus } from "@/lib/capabilities";
import type { DashboardView } from "@/lib/dashboard-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type WorkspaceOverviewProps = {
  authenticated: boolean;
  capabilities: CapabilityStatus[];
  language: "en" | "vi";
  workspaceLabel?: string;
  onOpen: (view: DashboardView) => void;
};

const workspaceJobs: {
  view: Exclude<DashboardView, "overview">;
  capability: CapabilityKey;
  icon: typeof BarChart3Icon;
  title: { en: string; vi: string };
  description: { en: string; vi: string };
  output: { en: string; vi: string };
}[] = [
  {
    view: "ads",
    capability: "meta_analysis",
    icon: BarChart3Icon,
    title: { en: "Diagnose performance", vi: "Chẩn đoán hiệu quả" },
    description: {
      en: "Find the highest-impact cause, inspect its evidence, and decide what changes next.",
      vi: "Tìm nguyên nhân tác động lớn nhất, xem evidence và quyết định thay đổi tiếp theo.",
    },
    output: { en: "Diagnosis → evidence → action", vi: "Chẩn đoán → evidence → hành động" },
  },
  {
    view: "competitor",
    capability: "competitor_evidence",
    icon: SearchIcon,
    title: { en: "Investigate competitors", vi: "Nghiên cứu đối thủ" },
    description: {
      en: "Collect ads through Apify, review advertiser provenance, and turn accepted evidence into original test briefs.",
      vi: "Thu thập ads qua Apify, duyệt provenance advertiser và biến evidence đã chấp nhận thành brief test mới.",
    },
    output: { en: "Collect → review → analyze", vi: "Thu thập → duyệt → phân tích" },
  },
  {
    view: "tiktok",
    capability: "tiktok_profiles",
    icon: ActivityIcon,
    title: { en: "Track TikTok signals", vi: "Theo dõi tín hiệu TikTok" },
    description: {
      en: "Inspect public channel and video signals without mixing them with Ads Manager performance.",
      vi: "Xem tín hiệu channel và video public mà không trộn với hiệu quả Ads Manager.",
    },
    output: { en: "Channel → videos → creative signals", vi: "Channel → video → creative signal" },
  },
  {
    view: "publisher",
    capability: "page_publishing",
    icon: CalendarClockIcon,
    title: { en: "Publish with control", vi: "Đăng bài có kiểm soát" },
    description: {
      en: "Prepare, preview, confirm, and track Facebook Page submissions.",
      vi: "Chuẩn bị, preview, xác nhận và theo dõi bài gửi lên Facebook Page.",
    },
    output: { en: "Draft → review → submission", vi: "Bản nháp → duyệt → gửi" },
  },
];

const capabilityCopy: Record<CapabilityKey, { en: string; vi: string }> = {
  meta_analysis: { en: "Meta performance", vi: "Hiệu quả Meta" },
  competitor_evidence: { en: "Competitor evidence", vi: "Evidence đối thủ" },
  tiktok_profiles: { en: "TikTok profiles", vi: "Profile TikTok" },
  tiktok_ad_library: { en: "TikTok Ad Library", vi: "TikTok Ad Library" },
  page_publishing: { en: "Page publishing", vi: "Đăng bài Page" },
  ai_enhancement: { en: "AI enhancement", vi: "AI enhancement" },
};

const stateCopy: Record<CapabilityState, { en: string; vi: string }> = {
  available: { en: "Available", vi: "Sẵn sàng" },
  needs_connection: { en: "Connect Meta", vi: "Kết nối Meta" },
  needs_setup: { en: "Needs setup", vi: "Cần thiết lập" },
  degraded: { en: "Local fallback", vi: "Fallback local" },
  paused: { en: "Paused", vi: "Tạm dừng" },
  unknown: { en: "Status unavailable", vi: "Không đọc được trạng thái" },
};

function stateVariant(state: CapabilityState): "success" | "secondary" | "outline" | "destructive" {
  if (state === "available") return "success";
  if (state === "degraded") return "secondary";
  if (state === "paused") return "outline";
  if (state === "unknown") return "destructive";
  return "secondary";
}

function stateIcon(state: CapabilityState) {
  if (state === "available") return CheckCircle2Icon;
  if (state === "paused") return CircleDashedIcon;
  if (state === "degraded") return SparklesIcon;
  return ShieldAlertIcon;
}

export function WorkspaceOverview({
  authenticated,
  capabilities,
  language,
  workspaceLabel,
  onOpen,
}: WorkspaceOverviewProps) {
  const capabilityMap = new Map(capabilities.map((capability) => [capability.key, capability]));
  const defaultState: CapabilityState = "unknown";
  const statePriority: Record<CapabilityState, number> = {
    available: 0,
    degraded: 1,
    needs_connection: 2,
    needs_setup: 3,
    paused: 4,
    unknown: 5,
  };
  const orderedJobs = [...workspaceJobs].sort((left, right) => {
    const leftState = capabilityMap.get(left.capability)?.state || defaultState;
    const rightState = capabilityMap.get(right.capability)?.state || defaultState;
    return statePriority[leftState] - statePriority[rightState];
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <CardDescription>{language === "vi" ? "Client workspace" : "Client workspace"}</CardDescription>
              <CardTitle className="text-2xl">{workspaceLabel || (language === "vi" ? "Workspace chưa gán client" : "Unassigned workspace")}</CardTitle>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {language === "vi"
                  ? "Chọn công việc cần hoàn thành. Mỗi workspace đưa evidence đến quyết định thay vì mở một dashboard chung chung."
                  : "Choose the job to complete. Each workspace moves evidence toward a decision instead of opening a generic dashboard."}
              </p>
            </div>
            <Badge variant={authenticated ? "success" : "secondary"} className="w-fit">
              {authenticated
                ? language === "vi" ? "Meta đã kết nối" : "Meta connected"
                : language === "vi" ? "Meta chưa kết nối" : "Meta not connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {orderedJobs.map((job) => {
              const state = capabilityMap.get(job.capability)?.state || defaultState;
              const Icon = job.icon;
              return (
                <div key={job.view} className="grid gap-4 p-4 transition-colors hover:bg-muted/35 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl border bg-background text-muted-foreground">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-base font-semibold">{job.title[language]}</h2>
                      <Badge variant={stateVariant(state)}>{stateCopy[state][language]}</Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{job.description[language]}</p>
                    <p className="mt-2 text-xs font-medium text-foreground/75">{job.output[language]}</p>
                  </div>
                  <Button type="button" variant={state === "available" ? "default" : "outline"} onClick={() => onOpen(job.view)} className="w-full sm:w-auto">
                    {state === "needs_connection"
                      ? language === "vi" ? "Kết nối" : "Connect"
                      : state === "needs_setup"
                        ? language === "vi" ? "Mở thiết lập" : "Open setup"
                        : state === "unknown"
                          ? language === "vi" ? "Mở và kiểm tra" : "Open and check"
                        : language === "vi" ? "Mở workspace" : "Open workspace"}
                    <ArrowUpRightIcon data-icon="inline-end" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl border bg-background text-muted-foreground">
              <WaypointsIcon className="size-4" />
            </span>
            <div>
              <CardTitle>{language === "vi" ? "Capability status" : "Capability status"}</CardTitle>
              <CardDescription>{language === "vi" ? "Trạng thái thật của từng nguồn." : "The real state of every source."}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {capabilities.map((capability, index) => {
            const StateIcon = stateIcon(capability.state);
            return (
              <div key={capability.key}>
                {index > 0 ? <Separator className="mb-3" /> : null}
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <StateIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{capabilityCopy[capability.key][language]}</span>
                  </span>
                  <Badge variant={stateVariant(capability.state)} className="shrink-0">
                    {stateCopy[capability.state][language]}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
