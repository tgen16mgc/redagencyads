import type { DashboardReport, InterfaceLanguage } from "@/lib/types";

type HealthCheck = DashboardReport["health"]["checks"][number];

const labels: Record<string, string> = {
  "M-CR4": "Chuẩn CTR",
  "M-CR2": "Tần suất nhóm khách hàng mới",
  M25: "Độ phủ creative/quảng cáo",
  M11: "Mức độ tinh gọn chiến dịch",
};

export function localizeHealthCheck(check: HealthCheck, language: InterfaceLanguage): HealthCheck {
  if (language !== "vi") return check;

  const values = check.detail.match(/\d+(?:\.\d+)?/g) || [];
  const decimal = (value: string | undefined) => value?.replace(".", ",") || "-";

  let detail = check.detail;
  if (check.id === "M-CR4" && values.length >= 2) {
    detail = `CTR ${decimal(values[0])}%. Ngưỡng đạt của gói >= ${decimal(values[1])}%.`;
  } else if (check.id === "M-CR2" && values.length) {
    detail = `Tần suất trung bình ${decimal(values[0])}.`;
  } else if (check.id === "M25" && values.length) {
    detail = `Có ${values[0]} quảng cáo trong phạm vi đã chọn. Mục tiêu: từ 10 creative đa dạng trở lên khi ngân sách phù hợp.`;
  } else if (check.id === "M11" && values.length) {
    detail = `Có ${values[0]} chiến dịch được chọn. Meta ưu tiên ít chiến dịch hơn cho mỗi mục tiêu.`;
  }

  return {
    ...check,
    label: labels[check.id] || check.label,
    detail,
  };
}
