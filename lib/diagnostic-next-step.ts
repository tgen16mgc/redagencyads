import type { InterfaceLanguage } from "@/lib/types";
import type { DiagnosticId, DiagnosticSeverity } from "@/lib/diagnosis";

type Bilingual = { en: string; vi: string };

const COLLECT_MORE: Bilingual = {
  en: "Not enough data yet — keep the setup running and revisit once more spend and conversions accumulate.",
  vi: "Chưa đủ dữ liệu — giữ nguyên cấu hình và xem lại khi đã tích lũy thêm chi tiêu và chuyển đổi.",
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
    risk: { en: "Do not kill or scale the downgraded rows yet — let them gather more evidence.", vi: "Chưa kill hoặc scale các dòng bị hạ cấp — để chúng tích lũy thêm bằng chứng." },
    watch: { en: "Treat downgraded rows as watch-only until delivery stabilizes.", vi: "Xem các dòng bị hạ cấp là chỉ theo dõi đến khi phân phối ổn định." },
    ok: { en: "Act on these rows with confidence — the evidence is strong enough.", vi: "Hành động với các dòng này một cách tự tin — bằng chứng đã đủ mạnh." },
  },
  creativeVolume: {
    risk: { en: "Add fresh creatives to the constrained ad sets to widen the testing pool.", vi: "Thêm creative mới vào các ad set bị hạn chế để mở rộng nguồn test." },
    watch: { en: "Queue a few new creatives for the ad sets running thin.", vi: "Chuẩn bị thêm vài creative mới cho các ad set đang ít mẫu." },
    ok: { en: "Creative supply is adequate — keep rotating as performance dictates.", vi: "Nguồn creative đủ — tiếp tục xoay mẫu theo hiệu quả." },
  },
  budgetMove: {
    risk: { en: "Shift budget from the source to the target row as recommended.", vi: "Chuyển ngân sách từ dòng nguồn sang dòng đích theo đề xuất." },
    watch: { en: "Review the suggested move and apply it if it fits your guardrails.", vi: "Xem đề xuất chuyển ngân sách và áp dụng nếu phù hợp giới hạn của bạn." },
    ok: { en: "Apply the guarded source-to-target transfer, then review delivery before the next step.", vi: "Áp dụng điều chuyển có guardrail từ dòng nguồn sang dòng đích, rồi rà soát phân phối trước bước tiếp theo." },
  },
  funnelLeakage: {
    risk: { en: "Fix the leaking stage (landing page or checkout) before adding spend.", vi: "Khắc phục bước rò rỉ (landing page hoặc checkout) trước khi tăng chi tiêu." },
    watch: { en: "Investigate the weakest funnel stage against its benchmark.", vi: "Kiểm tra bước phễu yếu nhất so với mốc chuẩn." },
    ok: { en: "Funnel conversion is healthy — focus effort upstream on traffic quality.", vi: "Tỷ lệ chuyển đổi phễu tốt — tập trung vào chất lượng traffic đầu phễu." },
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
    risk: { en: "Redistribute spend so starved creatives get enough delivery to prove out.", vi: "Phân bổ lại chi tiêu để các creative bị bỏ đói có đủ phân phối để chứng minh." },
    watch: { en: "Give the under-delivered creatives a budget floor or separate ad set.", vi: "Cấp ngân sách tối thiểu hoặc tách ad set riêng cho các creative ít phân phối." },
    ok: { en: "Spend is spread fairly across creatives — no action needed.", vi: "Chi tiêu được phân bổ hợp lý giữa các creative — không cần hành động." },
  },
  breakdownWaste: {
    risk: { en: "Exclude or cut budget on the high-spend, low-result segments.", vi: "Loại trừ hoặc cắt ngân sách ở các phân khúc chi nhiều nhưng kết quả thấp." },
    watch: { en: "Watch the flagged segments and trim them if waste persists.", vi: "Theo dõi các phân khúc bị gắn cờ và cắt giảm nếu lãng phí kéo dài." },
    ok: { en: "Spend maps to results across segments — leave allocation as is.", vi: "Chi tiêu tương xứng kết quả giữa các phân khúc — giữ nguyên phân bổ." },
  },
  resultConcentration: {
    risk: { en: "De-risk by proving repeatability in more rows before scaling the top performer.", vi: "Giảm rủi ro bằng cách chứng minh độ lặp lại ở nhiều dòng trước khi scale dòng dẫn đầu." },
    watch: { en: "Scale cautiously and develop backup winners alongside the top rows.", vi: "Scale thận trọng và phát triển thêm dòng thắng dự phòng bên cạnh dòng dẫn đầu." },
    ok: { en: "Results are spread across rows — portfolio risk is low.", vi: "Kết quả phân bổ trên nhiều dòng — rủi ro portfolio thấp." },
  },
  spendPacing: {
    risk: { en: "Diagnose why severely underpacing campaigns can't spend — bid, audience, or schedule.", vi: "Tìm hiểu vì sao campaign tiêu quá chậm không tiêu được — giá thầu, đối tượng hoặc lịch chạy." },
    watch: { en: "Loosen bids or widen targeting on the underpacing campaigns.", vi: "Nới giá thầu hoặc mở rộng nhắm mục tiêu cho các campaign tiêu chậm." },
    ok: { en: "Spend is on pace with the budget — no pacing action needed.", vi: "Chi tiêu đúng nhịp ngân sách — không cần điều chỉnh." },
  },
  consolidationPressure: {
    risk: { en: "Consolidate ad sets so each clears the weekly conversion threshold to exit learning.", vi: "Hợp nhất ad set để mỗi cái đạt ngưỡng chuyển đổi tuần và thoát learning." },
    watch: { en: "Consider merging the thinnest ad sets to speed up learning-phase exit.", vi: "Cân nhắc gộp các ad set mỏng nhất để thoát learning nhanh hơn." },
    ok: { en: "Ad sets clear the learning threshold — keep the current structure.", vi: "Các ad set vượt ngưỡng learning — giữ nguyên cấu trúc hiện tại." },
  },
  costCapDelivery: {
    risk: { en: "Raise the cost cap or bid on constrained campaigns so they can spend the budget.", vi: "Tăng cost cap hoặc giá thầu cho campaign bị hạn chế để tiêu hết ngân sách." },
    watch: { en: "Review the underdelivering campaigns and ease the cap if results allow.", vi: "Xem các campaign phân phối thiếu và nới cap nếu kết quả cho phép." },
    ok: { en: "Caps aren't throttling delivery — leave them in place.", vi: "Cap không kìm phân phối — giữ nguyên." },
  },
  measurementQuality: {
    risk: { en: "Fix tracking (pixel/CAPI) before trusting these conversion numbers.", vi: "Sửa tracking (pixel/CAPI) trước khi tin vào các con số chuyển đổi này." },
    watch: { en: "Verify event setup so attribution gaps don't skew decisions.", vi: "Kiểm tra thiết lập sự kiện để khoảng trống attribution không làm lệch quyết định." },
    ok: { en: "Measurement looks reliable — decisions can lean on these numbers.", vi: "Đo lường đáng tin — có thể dựa vào các con số này để quyết định." },
  },
};

export function diagnosticNextStep(id: DiagnosticId, severity: DiagnosticSeverity, language: InterfaceLanguage): string {
  if (severity === "insufficient") return COLLECT_MORE[language];
  return STEPS[id][severity][language];
}
