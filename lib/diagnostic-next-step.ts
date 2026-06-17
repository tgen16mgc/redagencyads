import type { InterfaceLanguage } from "@/lib/types";

export type DiagnosticKind =
  | "healthTriage"
  | "dailyDiagnosis"
  | "experimentReadiness"
  | "decisionConfidence"
  | "creativeVolume"
  | "budgetMove"
  | "funnelLeakage"
  | "audienceOverlap"
  | "targetingExclusions"
  | "creativeStarvation"
  | "breakdownWaste"
  | "resultConcentration"
  | "spendPacing"
  | "consolidationPressure"
  | "costCapDelivery"
  | "measurementQuality";

export type DiagnosticTone = "critical" | "warning" | "ok" | "insufficient";

type Bilingual = { en: string; vi: string };

const COLLECT_MORE: Bilingual = {
  en: "Not enough data yet — keep the setup running and revisit once more spend and conversions accumulate.",
  vi: "Chưa đủ dữ liệu — giữ nguyên cấu hình và xem lại khi đã tích lũy thêm chi tiêu và chuyển đổi.",
};

const STEPS: Record<DiagnosticKind, Record<Exclude<DiagnosticTone, "insufficient">, Bilingual>> = {
  healthTriage: {
    critical: { en: "Work the red items at the top of the queue first before touching budgets.", vi: "Xử lý các mục đỏ đầu hàng đợi trước khi điều chỉnh ngân sách." },
    warning: { en: "Schedule the warning items into this week's optimization pass.", vi: "Đưa các mục cảnh báo vào đợt tối ưu trong tuần này." },
    ok: { en: "Hold the current setup and keep monitoring the daily trend.", vi: "Giữ nguyên cấu hình hiện tại và tiếp tục theo dõi xu hướng theo ngày." },
  },
  dailyDiagnosis: {
    critical: { en: "Act on the top cause now — it is driving the largest swing in results.", vi: "Xử lý nguyên nhân hàng đầu ngay — nó gây biến động kết quả lớn nhất." },
    warning: { en: "Review the listed causes and adjust the affected ad sets this week.", vi: "Xem lại các nguyên nhân và điều chỉnh các ad set liên quan trong tuần." },
    ok: { en: "No root-cause action needed; keep the current trajectory.", vi: "Không cần xử lý nguyên nhân; giữ nguyên hướng đi hiện tại." },
  },
  experimentReadiness: {
    critical: { en: "Clear the blockers before launching the test — results would not be trustworthy yet.", vi: "Giải quyết các yếu tố cản trở trước khi chạy test — kết quả chưa đáng tin." },
    warning: { en: "Address the open blocker, then start the experiment.", vi: "Xử lý yếu tố cản trở còn lại rồi bắt đầu thử nghiệm." },
    ok: { en: "Launch the planned experiment — readiness checks pass.", vi: "Khởi chạy thử nghiệm đã lên kế hoạch — các kiểm tra đã đạt." },
  },
  decisionConfidence: {
    critical: { en: "Do not kill or scale the downgraded rows yet — let them gather more evidence.", vi: "Chưa kill hoặc scale các dòng bị hạ cấp — để chúng tích lũy thêm bằng chứng." },
    warning: { en: "Treat downgraded rows as watch-only until delivery stabilizes.", vi: "Xem các dòng bị hạ cấp là chỉ theo dõi đến khi phân phối ổn định." },
    ok: { en: "Act on these rows with confidence — the evidence is strong enough.", vi: "Hành động với các dòng này một cách tự tin — bằng chứng đã đủ mạnh." },
  },
  creativeVolume: {
    critical: { en: "Add fresh creatives to the constrained ad sets to widen the testing pool.", vi: "Thêm creative mới vào các ad set bị hạn chế để mở rộng nguồn test." },
    warning: { en: "Queue a few new creatives for the ad sets running thin.", vi: "Chuẩn bị thêm vài creative mới cho các ad set đang ít mẫu." },
    ok: { en: "Creative supply is adequate — keep rotating as performance dictates.", vi: "Nguồn creative đủ — tiếp tục xoay mẫu theo hiệu quả." },
  },
  budgetMove: {
    critical: { en: "Shift budget from the source to the target row as recommended.", vi: "Chuyển ngân sách từ dòng nguồn sang dòng đích theo đề xuất." },
    warning: { en: "Review the suggested move and apply it if it fits your guardrails.", vi: "Xem đề xuất chuyển ngân sách và áp dụng nếu phù hợp giới hạn của bạn." },
    ok: { en: "Hold budgets — no reallocation is justified right now.", vi: "Giữ ngân sách — chưa cần phân bổ lại lúc này." },
  },
  funnelLeakage: {
    critical: { en: "Fix the leaking stage (landing page or checkout) before adding spend.", vi: "Khắc phục bước rò rỉ (landing page hoặc checkout) trước khi tăng chi tiêu." },
    warning: { en: "Investigate the weakest funnel stage against its benchmark.", vi: "Kiểm tra bước phễu yếu nhất so với mốc chuẩn." },
    ok: { en: "Funnel conversion is healthy — focus effort upstream on traffic quality.", vi: "Tỷ lệ chuyển đổi phễu tốt — tập trung vào chất lượng traffic đầu phễu." },
  },
  audienceOverlap: {
    critical: { en: "Consolidate or exclude the overlapping ad sets to stop bidding against yourself.", vi: "Hợp nhất hoặc loại trừ các ad set trùng nhau để tránh tự cạnh tranh giá thầu." },
    warning: { en: "Check the similar ad sets and add exclusions where they compete.", vi: "Kiểm tra các ad set tương đồng và thêm loại trừ ở nơi chúng cạnh tranh." },
    ok: { en: "Audiences look distinct — no consolidation needed.", vi: "Đối tượng tách biệt — không cần hợp nhất." },
  },
  targetingExclusions: {
    critical: { en: "Add the missing exclusions so prospecting and retargeting stop colliding.", vi: "Thêm các loại trừ còn thiếu để prospecting và retargeting không chồng lấn." },
    warning: { en: "Review the flagged ad sets and tighten their exclusion rules.", vi: "Xem các ad set bị gắn cờ và siết lại quy tắc loại trừ." },
    ok: { en: "Exclusions look clean — no targeting overlap to fix.", vi: "Loại trừ ổn — không có trùng lắp nhắm mục tiêu cần sửa." },
  },
  creativeStarvation: {
    critical: { en: "Redistribute spend so starved creatives get enough delivery to prove out.", vi: "Phân bổ lại chi tiêu để các creative bị bỏ đói có đủ phân phối để chứng minh." },
    warning: { en: "Give the under-delivered creatives a budget floor or separate ad set.", vi: "Cấp ngân sách tối thiểu hoặc tách ad set riêng cho các creative ít phân phối." },
    ok: { en: "Spend is spread fairly across creatives — no action needed.", vi: "Chi tiêu được phân bổ hợp lý giữa các creative — không cần hành động." },
  },
  breakdownWaste: {
    critical: { en: "Exclude or cut budget on the high-spend, low-result segments.", vi: "Loại trừ hoặc cắt ngân sách ở các phân khúc chi nhiều nhưng kết quả thấp." },
    warning: { en: "Watch the flagged segments and trim them if waste persists.", vi: "Theo dõi các phân khúc bị gắn cờ và cắt giảm nếu lãng phí kéo dài." },
    ok: { en: "Spend maps to results across segments — leave allocation as is.", vi: "Chi tiêu tương xứng kết quả giữa các phân khúc — giữ nguyên phân bổ." },
  },
  resultConcentration: {
    critical: { en: "De-risk by proving repeatability in more rows before scaling the top performer.", vi: "Giảm rủi ro bằng cách chứng minh độ lặp lại ở nhiều dòng trước khi scale dòng dẫn đầu." },
    warning: { en: "Scale cautiously and develop backup winners alongside the top rows.", vi: "Scale thận trọng và phát triển thêm dòng thắng dự phòng bên cạnh dòng dẫn đầu." },
    ok: { en: "Results are spread across rows — portfolio risk is low.", vi: "Kết quả phân bổ trên nhiều dòng — rủi ro portfolio thấp." },
  },
  spendPacing: {
    critical: { en: "Diagnose why severely underpacing campaigns can't spend — bid, audience, or schedule.", vi: "Tìm hiểu vì sao campaign tiêu quá chậm không tiêu được — giá thầu, đối tượng hoặc lịch chạy." },
    warning: { en: "Loosen bids or widen targeting on the underpacing campaigns.", vi: "Nới giá thầu hoặc mở rộng nhắm mục tiêu cho các campaign tiêu chậm." },
    ok: { en: "Spend is on pace with the budget — no pacing action needed.", vi: "Chi tiêu đúng nhịp ngân sách — không cần điều chỉnh." },
  },
  consolidationPressure: {
    critical: { en: "Consolidate ad sets so each clears the weekly conversion threshold to exit learning.", vi: "Hợp nhất ad set để mỗi cái đạt ngưỡng chuyển đổi tuần và thoát learning." },
    warning: { en: "Consider merging the thinnest ad sets to speed up learning-phase exit.", vi: "Cân nhắc gộp các ad set mỏng nhất để thoát learning nhanh hơn." },
    ok: { en: "Ad sets clear the learning threshold — keep the current structure.", vi: "Các ad set vượt ngưỡng learning — giữ nguyên cấu trúc hiện tại." },
  },
  costCapDelivery: {
    critical: { en: "Raise the cost cap or bid on constrained campaigns so they can spend the budget.", vi: "Tăng cost cap hoặc giá thầu cho campaign bị hạn chế để tiêu hết ngân sách." },
    warning: { en: "Review the underdelivering campaigns and ease the cap if results allow.", vi: "Xem các campaign phân phối thiếu và nới cap nếu kết quả cho phép." },
    ok: { en: "Caps aren't throttling delivery — leave them in place.", vi: "Cap không kìm phân phối — giữ nguyên." },
  },
  measurementQuality: {
    critical: { en: "Fix tracking (pixel/CAPI) before trusting these conversion numbers.", vi: "Sửa tracking (pixel/CAPI) trước khi tin vào các con số chuyển đổi này." },
    warning: { en: "Verify event setup so attribution gaps don't skew decisions.", vi: "Kiểm tra thiết lập sự kiện để khoảng trống attribution không làm lệch quyết định." },
    ok: { en: "Measurement looks reliable — decisions can lean on these numbers.", vi: "Đo lường đáng tin — có thể dựa vào các con số này để quyết định." },
  },
};

export function diagnosticNextStep(kind: DiagnosticKind, tone: DiagnosticTone, language: InterfaceLanguage): string {
  if (tone === "insufficient") return COLLECT_MORE[language];
  return STEPS[kind][tone][language];
}
