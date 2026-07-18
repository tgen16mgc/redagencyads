import type { DashboardView } from "@/lib/dashboard-access";
import type { InterfaceLanguage } from "@/lib/types";

export const CONTEXT_CHAT_PANEL_ID = "context-chat-panel";

const VIEW_LABELS: Record<DashboardView, { en: string; vi: string }> = {
  overview: { en: "Overview", vi: "Tổng quan" },
  ads: { en: "Performance", vi: "Hiệu quả" },
  competitor: { en: "Competitor", vi: "Đối thủ" },
  tiktok: { en: "TikTok", vi: "TikTok" },
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
    working: isVietnamese ? "Trợ lý AI đang phân tích" : "Smart assistant is analyzing",
    live: isVietnamese ? "AI sẵn sàng" : "AI ready",
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
    genericError: isVietnamese ? "Không thể nhận câu trả lời từ trợ lý AI." : "Could not get an answer from the smart assistant.",
    suggestions: SUGGESTIONS[view][language],
  };
}
