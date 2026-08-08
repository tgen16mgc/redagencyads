import type { DashboardView } from "@/lib/dashboard-access";
import type { InterfaceLanguage } from "@/lib/types";

export const CONTEXT_CHAT_PANEL_ID = "context-chat-panel";

const VIEW_LABELS: Record<DashboardView, { en: string; vi: string }> = {
  overview: { en: "Overview", vi: "Tổng quan" },
  ads: { en: "Performance", vi: "Hiệu quả" },
  competitor: { en: "Competitor", vi: "Đối thủ" },
  tiktok: { en: "TikTok", vi: "TikTok" },
  intelligence: { en: "Intelligence", vi: "Intelligence" },
  publisher: { en: "Publishing", vi: "Đăng bài" },
};

const SUGGESTIONS: Record<DashboardView, { en: string[]; vi: string[] }> = {
  overview: {
    en: ["What can I do here?", "What needs setup first?", "Which workspace should I open?"],
    vi: ["Tôi có thể làm gì ở đây?", "Cần thiết lập gì trước?", "Nên mở workspace nào?"],
  },
  ads: {
    en: ["What should I fix first?", "Explain the biggest performance risk", "Write a client-ready summary"],
    vi: ["Nên sửa gì trước?", "Giải thích rủi ro hiệu quả lớn nhất", "Viết tóm tắt gửi client"],
  },
  competitor: {
    en: ["What angle is missing?", "Compare the accepted evidence", "Draft the next creative test"],
    vi: ["Đang thiếu angle nào?", "So sánh evidence đã duyệt", "Viết creative test tiếp theo"],
  },
  tiktok: {
    en: ["Which videos stand out?", "Find repeatable hook patterns", "What should we test next?"],
    vi: ["Video nào nổi bật?", "Tìm pattern hook có thể lặp lại", "Nên test gì tiếp theo?"],
  },
  intelligence: {
    en: ["Which data is safe for budget decisions?", "Explain the quality gates", "What connector should we add next?"],
    vi: ["Nguồn nào an toàn cho quyết định ngân sách?", "Giải thích các quality gate", "Nên thêm connector nào tiếp theo?"],
  },
  publisher: {
    en: ["Improve this post copy", "Check the draft for risks", "Suggest a stronger opening hook"],
    vi: ["Cải thiện nội dung bài đăng", "Kiểm tra rủi ro trong draft", "Gợi ý opening hook mạnh hơn"],
  },
};

export function contextChatCopy(language: InterfaceLanguage, view: DashboardView) {
  const isVietnamese = language === "vi";
  return {
    viewLabel: VIEW_LABELS[view][language],
    assistantLabel: isVietnamese ? "Trợ lý AI" : "Smart assistant",
    title: isVietnamese ? "Trợ lý AI thông minh" : "Smart assistant",
    description: isVietnamese
      ? "Câu trả lời dùng dữ liệu đang hiển thị trong workspace này."
      : "Answers use the data currently visible in this workspace.",
    emptyTitle: isVietnamese ? "Bắt đầu từ công việc hiện tại" : "Start with the work in front of you",
    emptyDescription: isVietnamese
      ? "Chọn một gợi ý hoặc hỏi trực tiếp về dữ liệu trong tab này."
      : "Choose a prompt or ask directly about this tab's data.",
    placeholder: isVietnamese ? "Hỏi về workspace hiện tại..." : "Ask about the current workspace...",
    send: isVietnamese ? "Gửi" : "Send",
    cancel: isVietnamese ? "Huỷ" : "Cancel",
    close: isVietnamese ? "Đóng" : "Close",
    clear: isVietnamese ? "Xoá cuộc trò chuyện" : "Clear conversation",
    retry: isVietnamese ? "Thử lại" : "Retry",
    preparing: isVietnamese ? "Đang đọc dữ liệu workspace" : "Reading workspace data",
    analyzing: isVietnamese ? "Đang phân tích tín hiệu liên quan" : "Analyzing relevant signals",
    working: isVietnamese ? "Vẫn đang xử lý yêu cầu" : "Still working on your request",
    responding: isVietnamese ? "Đang soạn câu trả lời" : "Drafting the answer",
    live: isVietnamese ? "Đã cấu hình AI" : "AI configured",
    unavailable: isVietnamese ? "Trợ lý AI chưa được cấu hình" : "Smart assistant is not configured",
    unavailableDescription: isVietnamese
      ? "Cấu hình khoá AI trên server rồi khởi động lại ứng dụng."
      : "Configure the AI provider key on the server and restart the app.",
    privacy: isVietnamese
      ? "Dữ liệu tóm tắt của tab hiện tại được gửi tới nhà cung cấp AI. Token, file và raw payload không được gửi."
      : "A compact summary of this tab is sent to the configured AI provider. Tokens, files, and raw payloads are excluded.",
    stale: isVietnamese ? "Dựa trên ngữ cảnh trước đó" : "Based on earlier context",
    cancelled: isVietnamese ? "Đã dừng yêu cầu." : "Request stopped.",
    responseReady: isVietnamese ? "Trợ lý AI đã trả lời." : "Assistant response ready.",
    connectionError: isVietnamese
      ? "Mất kết nối với trợ lý AI. Hãy thử lại—tin nhắn của bạn đã được lưu."
      : "Lost the connection to the assistant. Retry—your message is saved.",
    invalidResponse: isVietnamese
      ? "Dịch vụ AI trả về phản hồi không hoàn chỉnh. Hãy thử lại—tin nhắn của bạn đã được lưu."
      : "The AI service returned an incomplete response. Retry—your message is saved.",
    interrupted: isVietnamese
      ? "Phản hồi bị gián đoạn. Hãy thử lại để nhận câu trả lời đầy đủ."
      : "Response interrupted. Retry for a complete answer.",
    genericError: isVietnamese
      ? "Trợ lý không thể hoàn tất yêu cầu này. Hãy thử lại—tin nhắn của bạn đã được lưu."
      : "The assistant could not complete this request. Retry—your message is saved.",
    suggestions: SUGGESTIONS[view][language],
  };
}
