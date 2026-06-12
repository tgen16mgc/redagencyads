import type { DashboardReport, NormalizedRow } from "@/lib/types";

export type LearningRiskStatus = "healthy" | "learning_limited_risk" | "insufficient_data";

export interface AdsetLearningReport {
  adsetId: string;
  adsetName: string;
  projectedConversions: number;
  status: LearningRiskStatus;
  reasonCode?: "LOW_VOLUME" | "NOT_ENOUGH_BUDGET" | "CREATIVE_FATIGUE" | "HIGH_OVERLAP" | "LOW_QUALITY";
  recommendation: { en: string; vi: string };
}

export type LearningLimitedAssessment = {
  status: LearningRiskStatus;
  variant: "secondary" | "outline" | "destructive";
  label: { en: string; vi: string };
  summary: { en: string; vi: string };
  adsets: AdsetLearningReport[];
};

const labels: Record<LearningRiskStatus, { en: string; vi: string }> = {
  healthy: { en: "Learning delivery healthy", vi: "Tốc độ học máy tốt" },
  learning_limited_risk: { en: "Learning limited risk", vi: "Rủi ro bị giới hạn học máy" },
  insufficient_data: { en: "Insufficient data", vi: "Chưa đủ dữ liệu" },
};

function getConversions(row: NormalizedRow, pack: string): number {
  if (pack === "sales_roas") return row.purchases || 0;
  if (pack === "lead_gen") return row.leads || 0;
  if (pack === "messages") return row.messages || 0;
  if (pack === "traffic") return row.linkClicks || 0;
  return 0;
}

function getEventLabel(pack: string, language: "en" | "vi"): string {
  const vi = language === "vi";
  if (pack === "sales_roas") return vi ? "đơn mua hàng" : "purchases";
  if (pack === "lead_gen") return vi ? "leads" : "leads";
  if (pack === "messages") return vi ? "tin nhắn" : "messages";
  if (pack === "traffic") return vi ? "lượt click" : "link clicks";
  return vi ? "kết quả" : "results";
}

export function assessLearningLimited(report: DashboardReport): LearningLimitedAssessment {
  const { totals, adsetRows, selectedPack, dateRange } = report;

  if (totals.spend <= 0 || adsetRows.length === 0) {
    return {
      status: "insufficient_data",
      variant: "outline",
      label: labels.insufficient_data,
      summary: {
        en: "Need served ad sets with spend before checking learning phase sufficiency.",
        vi: "Cần dữ liệu ad set có chi tiêu trước khi kiểm tra tốc độ học máy.",
      },
      adsets: [],
    };
  }

  if (selectedPack === "awareness") {
    return {
      status: "healthy",
      variant: "secondary",
      label: labels.healthy,
      summary: {
        en: "Awareness campaigns do not optimize for conversion-driven learning phase thresholds.",
        vi: "Campaign nhận diện thương hiệu không tối ưu theo ngưỡng học máy của chuyển đổi.",
      },
      adsets: [],
    };
  }

  const sinceTime = new Date(dateRange.since).getTime();
  const untilTime = new Date(dateRange.until).getTime();
  const days = Math.max(1, (untilTime - sinceTime) / (86400 * 1000) + 1);

  const adsets: AdsetLearningReport[] = [];

  for (const adset of adsetRows) {
    if (adset.spend <= 0) continue;

    const conversions = getConversions(adset, selectedPack);
    const projectedConversions = (conversions / days) * 7;
    const apiStatus = adset.learningStageStatus;
    const apiReason = adset.learningStageReasons?.[0];

    const isLimited =
      apiStatus === "LEARNING_LIMITED" ||
      (apiStatus === undefined && projectedConversions < 50);

    const status: LearningRiskStatus = isLimited ? "learning_limited_risk" : "healthy";

    let recEn = "";
    let recVi = "";
    let reasonCode: AdsetLearningReport["reasonCode"] = apiReason;

    if (status === "learning_limited_risk") {
      const eventNameEn = getEventLabel(selectedPack, "en");
      const eventNameVi = getEventLabel(selectedPack, "vi");

      if (apiReason === "NOT_ENOUGH_BUDGET") {
        recEn = `Budget is too low to reach the learning threshold. Increase daily budget to generate at least 50 ${eventNameEn} per week.`;
        recVi = `Ngân sách quá thấp để đạt ngưỡng học máy. Tăng ngân sách ngày để tạo ít nhất 50 ${eventNameVi}/tuần.`;
      } else if (apiReason === "CREATIVE_FATIGUE") {
        recEn = `Creative fatigue is blocking learning phase exit. Rotate creatives and add fresh ad variations to this ad set.`;
        recVi = `Mỏi creative đang chặn thoát learning phase. Thay thế creative và thêm mẫu quảng cáo mới cho ad set này.`;
      } else if (apiReason === "HIGH_OVERLAP") {
        recEn = `High audience overlap with other ad sets is splitting conversion signal. Consolidate overlapping ad sets or use audience exclusions.`;
        recVi = `Đối tượng trùng lắp cao với các ad set khác đang chia nhỏ tín hiệu chuyển đổi. Hợp nhất các ad set trùng lắp hoặc dùng audience exclusions.`;
      } else if (apiReason === "LOW_QUALITY") {
        recEn = `Ad quality is limiting delivery. Review ad relevance scores and improve creative quality or landing page experience.`;
        recVi = `Chất lượng quảng cáo đang hạn chế phân phối. Xem xét điểm relevance và cải thiện creative hoặc trải nghiệm trang đích.`;
      } else if (conversions === 0) {
        recEn = `Zero results. Move event up-funnel, expand audience sizes, or increase daily budget to kickstart delivery.`;
        recVi = `Chưa có kết quả. Hãy cân nhắc di chuyển sự kiện tối ưu lên phễu cao hơn, mở rộng đối tượng hoặc tăng ngân sách để kích hoạt phân phối.`;
      } else {
        recEn = `Projected weekly ${eventNameEn} is ${projectedConversions.toFixed(1)} (threshold is 50). Consolidate overlapping ad sets to merge conversion volume.`;
        recVi = `Dự kiến đạt ${projectedConversions.toFixed(1)} ${eventNameVi}/tuần (ngưỡng thoát học máy là 50). Hãy gộp các ad set trùng lặp để dồn volume.`;
      }
    } else {
      recEn = `Ad set is pacing well to exit learning phase.`;
      recVi = `Tốc độ chuyển đổi tốt, sẵn sàng thoát khỏi giai đoạn học máy.`;
    }

    adsets.push({
      adsetId: adset.id,
      adsetName: adset.name,
      projectedConversions,
      status,
      reasonCode,
      recommendation: { en: recEn, vi: recVi },
    });
  }

  const hasRisk = adsets.some((item) => item.status === "learning_limited_risk");
  const status = hasRisk ? "learning_limited_risk" : "healthy";

  return {
    status,
    variant: status === "learning_limited_risk" ? "destructive" : "secondary",
    label: labels[status],
    summary: {
      en: status === "learning_limited_risk"
        ? "Some active ad sets are at risk of remaining stuck in the learning phase, leading to volatile CPA."
        : "All active ad sets are on track to achieve the required 50 weekly conversions.",
      vi: status === "learning_limited_risk"
        ? "Một số ad set đang chạy có nguy cơ bị kẹt trong giai đoạn học máy, dẫn đến CPA không ổn định."
        : "Tất cả ad set hoạt động đều đang đi đúng hướng để đạt 50 chuyển đổi hàng tuần.",
    },
    adsets,
  };
}
