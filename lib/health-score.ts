import type { DashboardReport, InterfaceLanguage } from "@/lib/types";
import { diagnoseDailyChange, type DailyDiagnosis } from "@/lib/daily-diagnosis";

export type TriageSeverity = "danger" | "warning" | "healthy";

export type TriageItem = {
  id: string;
  severity: TriageSeverity;
  title: { en: string; vi: string };
  detail: { en: string; vi: string };
};

export type HealthScoreSummary = {
  score: number;
  grade: string;
  severity: TriageSeverity;
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  items: TriageItem[];
  counts: Record<TriageSeverity, number>;
};

type HealthReportInput = Pick<DashboardReport, "health" | "dailyRows" | "selectedPack">;
type HealthCheck = DashboardReport["health"]["checks"][number];

function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

function severityForScore(score: number): TriageSeverity {
  if (score < 60) return "danger";
  if (score < 80) return "warning";
  return "healthy";
}

function checkSeverity(status: "pass" | "warning" | "fail"): TriageSeverity {
  if (status === "fail") return "danger";
  if (status === "warning") return "warning";
  return "healthy";
}

export function summarizeHealth(report: HealthReportInput): HealthScoreSummary {
  const diagnosis = diagnoseDailyChange({
    dailyRows: report.dailyRows,
    selectedPack: report.selectedPack,
  });
  return summarizeHealthInputs(report, diagnosis);
}

function summarizeHealthInputs(report: HealthReportInput, diagnosis: DailyDiagnosis): HealthScoreSummary {
  const items: TriageItem[] = report.health.checks.map((check) => {
    const vietnamese = localizeHealthCheck(check, "vi");
    return {
      id: `health-${check.id}`,
      severity: checkSeverity(check.status),
      title: { en: check.label, vi: vietnamese.label },
      detail: { en: check.detail, vi: vietnamese.detail },
    };
  });

  for (const cause of diagnosis.causes) {
    items.push({
      id: `daily-${cause.id}`,
      severity: cause.severity === "danger" ? "danger" : "warning",
      title: cause.title,
      detail: cause.action,
    });
  }

  const counts = {
    danger: items.filter((item) => item.severity === "danger").length,
    warning: items.filter((item) => item.severity === "warning").length,
    healthy: items.filter((item) => item.severity === "healthy").length,
  };

  const penalty = counts.danger * 12 + counts.warning * 6;
  const score = Math.max(0, Math.min(100, Math.round(report.health.score - penalty)));
  const severity = counts.danger > 0 ? "danger" : counts.warning > 0 ? "warning" : severityForScore(score);

  return {
    score,
    grade: gradeFor(score),
    severity,
    label: {
      en: severity === "danger" ? "Needs attention" : severity === "warning" ? "Watch list" : "Healthy",
      vi: severity === "danger" ? "Cần xử lý" : severity === "warning" ? "Cần theo dõi" : "Khỏe mạnh",
    },
    summary: {
      en: counts.danger > 0
        ? `${counts.danger} critical issue${counts.danger > 1 ? "s" : ""} should be reviewed before changing budget.`
        : counts.warning > 0
          ? `${counts.warning} watch item${counts.warning > 1 ? "s" : ""} may affect performance.`
          : "No critical diagnostic issues detected in this report.",
      vi: counts.danger > 0
        ? `${counts.danger} vấn đề nghiêm trọng cần rà soát trước khi đổi ngân sách.`
        : counts.warning > 0
          ? `${counts.warning} điểm cần theo dõi có thể ảnh hưởng hiệu quả.`
          : "Chưa phát hiện vấn đề chẩn đoán nghiêm trọng trong báo cáo này.",
    },
    items: items.sort((a, b) => {
      const order = { danger: 0, warning: 1, healthy: 2 };
      return order[a.severity] - order[b.severity];
    }),
    counts,
  };
}

export function localizedTriageItem(item: TriageItem, language: InterfaceLanguage) {
  return {
    ...item,
    titleText: item.title[language],
    detailText: item.detail[language],
  };
}

export function localizeHealthCheck(check: HealthCheck, language: InterfaceLanguage) {
  if (language === "en") return { label: check.label, detail: check.detail };

  if (check.id === "M-CR4") {
    const values = check.detail.match(/CTR\s+([\d.]+)%.*>=\s*([\d.]+)%/u);
    return {
      label: "Chuẩn CTR",
      detail: values
        ? `CTR ${values[1]}%. Ngưỡng đạt của KPI pack >= ${values[2]}%.`
        : "Đối chiếu CTR với ngưỡng của KPI pack hiện tại.",
    };
  }
  if (check.id === "M-CR2") {
    const value = check.detail.match(/Average frequency\s+([\d.]+)/u)?.[1];
    return {
      label: "Tần suất prospecting",
      detail: value ? `Tần suất trung bình ${value}.` : "Theo dõi tần suất trung bình để phát hiện bão hòa.",
    };
  }
  if (check.id === "M25") {
    const count = check.detail.match(/\b(\d+)\s+ads?\b/u)?.[1];
    return {
      label: "Độ phủ creative",
      detail: count
        ? check.status === "pass"
          ? `${count} quảng cáo đang hoạt động trong phạm vi này. Độ phủ creative đạt hướng dẫn 10 quảng cáo cho lượt rà soát này.`
          : `Chỉ có ${count} quảng cáo đang hoạt động trong phạm vi này. Thêm concept creative khác biệt trước khi scale; hướng tới tối thiểu 10 khi ngân sách cho phép.`
        : "Đánh giá độ phủ creative trong phạm vi đã chọn.",
    };
  }
  if (check.id === "M11") {
    const count = check.detail.match(/\b(\d+)\s+selected campaigns?\b/u)?.[1];
    return {
      label: "Hợp nhất campaign",
      detail: count
        ? `${count} campaign được chọn. Meta ưu tiên ít campaign hơn cho mỗi mục tiêu.`
        : "Đánh giá mức độ phân mảnh campaign trong phạm vi đã chọn.",
    };
  }
  return { label: check.label, detail: check.detail };
}
