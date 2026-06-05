import { classifyCreativeFatigue } from "@/lib/creative-fatigue";
import { assessMeasurementQuality } from "@/lib/measurement-quality";
import type { DashboardReport } from "@/lib/types";

export type ExperimentReadinessStatus = "ready" | "needs_fix" | "not_ready";

export type ExperimentReadiness = {
  status: ExperimentReadinessStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  blockers: { en: string[]; vi: string[] };
  nextAction: { en: string; vi: string };
};

const labels: Record<ExperimentReadinessStatus, { en: string; vi: string }> = {
  ready: { en: "Ready", vi: "Sẵn sàng" },
  needs_fix: { en: "Needs fix", vi: "Cần xử lý" },
  not_ready: { en: "Not ready", vi: "Chưa sẵn sàng" },
};

export function assessExperimentReadiness(report: DashboardReport): ExperimentReadiness {
  const measurement = assessMeasurementQuality(report);
  const healthFailed = report.health.score < 50 || report.health.checks.some((check) => check.status === "fail");
  const fatiguedCreative = report.adRows.some((row) => classifyCreativeFatigue(row).status === "fatigued");
  const blockers = { en: [] as string[], vi: [] as string[] };

  if (measurement.status === "unverified" || measurement.status === "not_applicable") {
    blockers.en.push("Fix measurement before launching: primary-result tracking is not verified for this KPI pack.");
    blockers.vi.push("Cần sửa đo lường trước khi launch: tracking kết quả chính chưa được xác minh cho bộ KPI này.");
  }

  if (healthFailed) {
    blockers.en.push("Account health has failing checks, so the experiment is not safe to launch yet.");
    blockers.vi.push("Có lỗi trong sức khỏe tài khoản nên chưa an toàn để launch thử nghiệm.");
  }

  if (blockers.en.length > 0) {
    return {
      status: "not_ready",
      variant: "destructive",
      label: labels.not_ready,
      blockers,
      nextAction: {
        en: "Fix blocking measurement or account-health issues before launching the experiment.",
        vi: "Sửa các lỗi đo lường hoặc sức khỏe tài khoản trước khi launch thử nghiệm.",
      },
    };
  }

  if (measurement.status === "limited") {
    blockers.en.push("Measurement is limited, so confirm value or ROAS tracking before scaling the test.");
    blockers.vi.push("Đo lường còn giới hạn, cần xác nhận tracking giá trị hoặc ROAS trước khi scale bài test.");
  }

  if (fatiguedCreative) {
    blockers.en.push("Creative fatigue is present, so rotate creative before launching the next test.");
    blockers.vi.push("Đang có dấu hiệu mỏi creative, nên thay creative trước khi launch bài test tiếp theo.");
  }

  if (blockers.en.length > 0) {
    return {
      status: "needs_fix",
      variant: "outline",
      label: labels.needs_fix,
      blockers,
      nextAction: {
        en: "Rotate creative or fix limited measurement before launching.",
        vi: "Thay creative hoặc xử lý đo lường còn giới hạn trước khi launch.",
      },
    };
  }

  return {
    status: "ready",
    variant: "secondary",
    label: labels.ready,
    blockers,
    nextAction: {
      en: "Launch the experiment with the current KPI pack and monitor early delivery quality.",
      vi: "Có thể launch thử nghiệm với bộ KPI hiện tại và theo dõi chất lượng phân phối ban đầu.",
    },
  };
}
