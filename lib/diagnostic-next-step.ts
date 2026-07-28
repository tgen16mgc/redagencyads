import type { InterfaceLanguage } from "@/lib/types";
import type { DiagnosticId, DiagnosticSeverity } from "@/lib/diagnosis";

type Bilingual = { en: string; vi: string };

const COLLECT_MORE: Bilingual = {
  en: "Keep the setup unchanged and review again after more spend and results accumulate.",
  vi: "Giữ nguyên cấu hình và xem lại khi có thêm chi tiêu và kết quả.",
};

const STEPS: Record<DiagnosticId, Record<Exclude<DiagnosticSeverity, "insufficient">, Bilingual>> = {
  healthTriage: {
    risk: { en: "Work the red items at the top of the queue first before touching budgets.", vi: "Xử lý các mục đỏ đầu hàng đợi trước khi điều chỉnh ngân sách." },
    watch: { en: "Schedule the warning items into this week's optimization pass.", vi: "Đưa các mục cảnh báo vào đợt tối ưu trong tuần này." },
    ok: { en: "Hold the current setup and keep monitoring the daily trend.", vi: "Giữ nguyên cấu hình hiện tại và tiếp tục theo dõi xu hướng theo ngày." },
  },
  dailyDiagnosis: {
    risk: { en: "Act on the top cause now — it is driving the largest swing in results.", vi: "Xử lý nguyên nhân hàng đầu ngay — nó gây biến động kết quả lớn nhất." },
    watch: { en: "Review the listed causes and adjust the affected ad sets this week.", vi: "Xem lại các nguyên nhân và điều chỉnh các ad set liên quan trong tuần." },
    ok: { en: "No root-cause action needed; keep the current trajectory.", vi: "Không cần xử lý nguyên nhân; giữ nguyên hướng đi hiện tại." },
  },
  experimentReadiness: {
    risk: { en: "Clear the blockers before launching the test — results would not be trustworthy yet.", vi: "Giải quyết các yếu tố cản trở trước khi chạy test — kết quả chưa đáng tin." },
    watch: { en: "Address the open blocker, then start the experiment.", vi: "Xử lý yếu tố cản trở còn lại rồi bắt đầu thử nghiệm." },
    ok: { en: "Launch the planned experiment — readiness checks pass.", vi: "Khởi chạy thử nghiệm đã lên kế hoạch — các kiểm tra đã đạt." },
  },
  decisionConfidence: {
    risk: { en: "Do not pause or increase budget on downgraded rows until they gather more evidence.", vi: "Chưa dừng hoặc tăng ngân sách ở các dòng bị hạ cấp; cần tích lũy thêm bằng chứng." },
    watch: { en: "Treat downgraded rows as watch-only until delivery stabilizes.", vi: "Xem các dòng bị hạ cấp là chỉ theo dõi đến khi phân phối ổn định." },
    ok: { en: "Act on these rows with confidence — the evidence is strong enough.", vi: "Hành động với các dòng này một cách tự tin — bằng chứng đã đủ mạnh." },
  },
  creativeVolume: {
    risk: { en: "Add new ad concepts to constrained ad sets to widen the testing pool.", vi: "Thêm mẫu quảng cáo mới vào các nhóm quảng cáo bị hạn chế để mở rộng nguồn thử nghiệm." },
    watch: { en: "Prepare a few new ad concepts for ad sets with limited variety.", vi: "Chuẩn bị thêm vài mẫu quảng cáo cho các nhóm đang ít phương án." },
    ok: { en: "Ad variety is adequate — rotate only when performance calls for it.", vi: "Số lượng mẫu quảng cáo đã đủ; chỉ xoay mẫu khi hiệu quả yêu cầu." },
  },
  budgetMove: {
    risk: { en: "Shift budget from the source to the target row as recommended.", vi: "Chuyển ngân sách từ dòng nguồn sang dòng đích theo đề xuất." },
    watch: { en: "Review the suggested budget shift and apply it only within the stated limits.", vi: "Rà soát đề xuất chuyển ngân sách và chỉ áp dụng trong giới hạn đã nêu." },
    ok: { en: "Apply the recommended budget shift, then review delivery before changing it again.", vi: "Áp dụng điều chuyển đề xuất rồi kiểm tra độ ổn định phân phối." },
  },
  funnelLeakage: {
    risk: { en: "Fix the leaking stage (landing page or checkout) before adding spend.", vi: "Khắc phục bước rò rỉ ở trang đích hoặc thanh toán trước khi tăng chi tiêu." },
    watch: { en: "Investigate the weakest funnel stage against its benchmark.", vi: "Kiểm tra bước phễu yếu nhất so với mốc chuẩn." },
    ok: { en: "Funnel conversion is healthy — focus on the quality of incoming traffic.", vi: "Tỷ lệ chuyển đổi phễu tốt; tập trung vào chất lượng lưu lượng đầu vào." },
  },
  audienceOverlap: {
    risk: { en: "Consolidate or exclude the overlapping ad sets to stop bidding against yourself.", vi: "Hợp nhất hoặc loại trừ các ad set trùng nhau để tránh tự cạnh tranh giá thầu." },
    watch: { en: "Check the similar ad sets and add exclusions where they compete.", vi: "Kiểm tra các ad set tương đồng và thêm loại trừ ở nơi chúng cạnh tranh." },
    ok: { en: "Audiences look distinct — no consolidation needed.", vi: "Đối tượng tách biệt — không cần hợp nhất." },
  },
  targetingExclusions: {
    risk: { en: "Add the missing exclusions so prospecting and retargeting stop colliding.", vi: "Thêm các loại trừ còn thiếu để prospecting và retargeting không chồng lấn." },
    watch: { en: "Review the flagged ad sets and tighten their exclusion rules.", vi: "Xem các ad set bị gắn cờ và siết lại quy tắc loại trừ." },
    ok: { en: "Exclusions look clean — no targeting overlap to fix.", vi: "Loại trừ ổn — không có trùng lắp nhắm mục tiêu cần sửa." },
  },
  creativeStarvation: {
    risk: { en: "Redistribute spend so under-delivered ads receive enough exposure to evaluate.", vi: "Phân bổ lại chi tiêu để các mẫu quảng cáo ít phân phối có đủ dữ liệu đánh giá." },
    watch: { en: "Set a minimum budget or separate ad set for under-delivered ads.", vi: "Đặt ngân sách tối thiểu hoặc tách nhóm riêng cho các mẫu quảng cáo ít phân phối." },
    ok: { en: "Spend is distributed fairly across ads — no action is needed.", vi: "Chi tiêu được phân bổ hợp lý giữa các mẫu quảng cáo; chưa cần hành động." },
  },
  breakdownWaste: {
    risk: { en: "Exclude or cut budget on the high-spend, low-result segments.", vi: "Loại trừ hoặc cắt ngân sách ở các phân khúc chi nhiều nhưng kết quả thấp." },
    watch: { en: "Watch the flagged segments and trim them if waste persists.", vi: "Theo dõi các phân khúc bị gắn cờ và cắt giảm nếu lãng phí kéo dài." },
    ok: { en: "Spend maps to results across segments — leave allocation as is.", vi: "Chi tiêu tương xứng kết quả giữa các phân khúc — giữ nguyên phân bổ." },
  },
  resultConcentration: {
    risk: { en: "Prove repeatable results in more rows before increasing budget on the top performer.", vi: "Chứng minh kết quả có thể lặp lại ở nhiều dòng trước khi tăng ngân sách dòng dẫn đầu." },
    watch: { en: "Increase budget cautiously and develop backup performers alongside the top rows.", vi: "Tăng ngân sách thận trọng và phát triển thêm dòng hiệu quả dự phòng." },
    ok: { en: "Results are spread across rows, so dependency risk is low.", vi: "Kết quả được phân bổ trên nhiều dòng nên rủi ro phụ thuộc thấp." },
  },
  spendPacing: {
    risk: { en: "Identify whether bids, audience size, or schedule are preventing campaigns from spending.", vi: "Xác định giá thầu, quy mô đối tượng hay lịch chạy đang cản chiến dịch chi tiêu." },
    watch: { en: "Review bids or audience breadth on campaigns spending below plan.", vi: "Rà soát giá thầu hoặc độ rộng đối tượng ở các chiến dịch chi tiêu dưới kế hoạch." },
    ok: { en: "Spend is on pace with the budget — no pacing action needed.", vi: "Chi tiêu đúng nhịp ngân sách — không cần điều chỉnh." },
  },
  consolidationPressure: {
    risk: { en: "Consolidate ad sets so each can reach the weekly conversion threshold.", vi: "Hợp nhất nhóm quảng cáo để mỗi nhóm có thể đạt ngưỡng chuyển đổi hằng tuần." },
    watch: { en: "Consider merging the thinnest ad sets to gather learning data faster.", vi: "Cân nhắc gộp các nhóm ít dữ liệu để tích lũy tín hiệu nhanh hơn." },
    ok: { en: "Ad sets clear the learning threshold — keep the current structure.", vi: "Các nhóm quảng cáo vượt ngưỡng học; giữ nguyên cấu trúc hiện tại." },
  },
  costCapDelivery: {
    risk: { en: "Raise the cost or bid limit on constrained campaigns so they can spend.", vi: "Tăng giới hạn chi phí hoặc giá thầu cho chiến dịch bị hạn chế để cải thiện phân phối." },
    watch: { en: "Review under-delivering campaigns and ease the limit if results support it.", vi: "Rà soát chiến dịch phân phối thấp và nới giới hạn nếu kết quả hỗ trợ." },
    ok: { en: "Current limits are not restricting delivery — keep them unchanged.", vi: "Các giới hạn hiện tại không kìm phân phối; giữ nguyên." },
  },
  measurementQuality: {
    risk: { en: "Fix Pixel/CAPI measurement before relying on these conversion numbers.", vi: "Khắc phục đo lường Pixel/CAPI trước khi dựa vào các số liệu chuyển đổi này." },
    watch: { en: "Verify event setup so attribution gaps do not distort decisions.", vi: "Kiểm tra thiết lập sự kiện để thiếu hụt phân bổ không làm lệch quyết định." },
    ok: { en: "Measurement looks reliable — decisions can lean on these numbers.", vi: "Đo lường đáng tin — có thể dựa vào các con số này để quyết định." },
  },
};

export function diagnosticNextStep(id: DiagnosticId, severity: DiagnosticSeverity, language: InterfaceLanguage): string {
  if (severity === "insufficient") return COLLECT_MORE[language];
  return STEPS[id][severity][language];
}
