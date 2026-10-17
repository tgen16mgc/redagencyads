"use client";

import * as React from "react";
import { WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { funnelHypothesisRequest, funnelHypothesisResponseSchema, type FunnelHypothesisResponse } from "@/lib/ai/funnel-hypothesis-contract";
import type { FunnelBriefDraft, FunnelObservation } from "@/lib/funnel-investigation";
import type { InterfaceLanguage } from "@/lib/types";

export function FunnelAiSuggestions({ observation, language, draft, onApply }: {
  observation: FunnelObservation;
  language: InterfaceLanguage;
  draft: FunnelBriefDraft;
  onApply: (draft: FunnelBriefDraft) => void;
}) {
  const t = (en: string, vi: string) => language === "vi" ? vi : en;
  const [result, setResult] = React.useState<FunnelHypothesisResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  const [pending, setPending] = React.useState<number | null>(null);
  const [applied, setApplied] = React.useState(false);
  const requestRef = React.useRef<AbortController | null>(null);
  const heading = React.useId();
  const metricLabel = (metric: FunnelBriefDraft["metric"]) => ({
    cpa: t("Cost per result (CPA)", "Chi phí mỗi kết quả (CPA)"),
    cost_per_lead: t("Cost per lead", "Chi phí mỗi lead"),
    roas: t("Return on ad spend (ROAS)", "Doanh thu trên chi tiêu quảng cáo (ROAS)"),
    ctr: t("Click-through rate (CTR)", "Tỷ lệ nhấp (CTR)"),
    conversion_rate: t("User conversion rate", "Tỷ lệ chuyển đổi người dùng"),
  })[metric];
  React.useEffect(() => () => requestRef.current?.abort(), []);

  const errors: Record<string, string> = {
    not_configured: t("AI is not configured for this workspace. Ask the workspace owner to connect a provider. You can still write your hypothesis below.", "Workspace chưa kết nối AI. Nhờ chủ workspace kết nối nhà cung cấp. Bạn vẫn có thể tự viết giả thuyết bên dưới."),
    unauthorized: t("Your session expired. Sign in again, then retry. Your draft has not changed.", "Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi thử lại. Bản nháp chưa thay đổi."),
    forbidden: t("Your workspace access could not be verified. Refresh the page and sign in again.", "Chưa xác minh được quyền truy cập workspace. Tải lại trang và đăng nhập lại."),
    rate_limit: t("Too many requests. Wait a few minutes, then try again. Your draft has not changed.", "Bạn đã gửi nhiều yêu cầu. Chờ vài phút rồi thử lại. Bản nháp chưa thay đổi."),
    timeout: t("AI took too long. Try again; your draft has not changed.", "AI phản hồi quá lâu. Thử lại; bản nháp chưa thay đổi."),
    unavailable: t("AI suggestions are unavailable right now. Try again or keep writing below. Your draft has not changed.", "Hiện chưa lấy được gợi ý AI. Thử lại hoặc tiếp tục tự viết bên dưới. Bản nháp chưa thay đổi."),
  };

  async function suggest() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setFailure(""); setPending(null); setApplied(false); setResult(null);
    const timer = window.setTimeout(() => controller.abort("timeout"), 100_000);
    try {
      const response = await fetch("/api/ai/funnel-hypotheses", {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(funnelHypothesisRequest(observation, language, draft.metric)),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : body.code || "unavailable");
      }
      const parsed = funnelHypothesisResponseSchema.parse(await response.json());
      const evidenceIds = new Set(parsed.evidence.map(item => item.id));
      if (parsed.suggestions.some(item => item.evidenceIds.some(id => !evidenceIds.has(id)))) throw new Error("unavailable");
      if (!controller.signal.aborted && requestRef.current === controller) setResult(parsed);
    } catch (error) {
      if (requestRef.current !== controller) return;
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      setFailure(controller.signal.reason === "timeout" ? "timeout" : error instanceof Error && errors[error.message] ? error.message : "unavailable");
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }

  function apply(index: number, replace = false) {
    const suggestion = result?.suggestions[index];
    if (!suggestion) return;
    if (!replace && [draft.hypothesis, draft.change, draft.guardrails].some(value => value.trim())) {
      setPending(index); setApplied(false); return;
    }
    onApply({ hypothesis: suggestion.hypothesis, change: suggestion.change, metric: suggestion.metric, guardrails: suggestion.guardrails });
    setPending(null); setApplied(true);
  }

  return <section className="funnel-ai" aria-labelledby={heading}>
    <div className="funnel-ai-toolbar"><div><h4 id={heading}>{t("Need a starting point?", "Cần gợi ý để bắt đầu?")}</h4><p>{t("AI uses this selected finding to suggest possible explanations and tests. Review before using.", "AI dùng phát hiện đang chọn để gợi ý cách giải thích và thử nghiệm. Xem lại trước khi dùng.")}</p></div><div className="funnel-ai-actions"><Button type="button" variant="outline" size="sm" onClick={suggest} disabled={busy}>{busy ? <Spinner data-icon="inline-start" /> : <WandSparklesIcon data-icon="inline-start" />}{busy ? t("Reading this finding…", "Đang đọc phát hiện…") : failure ? t("Try AI again", "Thử lại AI") : result ? t("Suggest again", "Gợi ý lại") : t("Suggest hypotheses", "Gợi ý giả thuyết")}</Button>{busy ? <Button type="button" variant="ghost" size="sm" onClick={() => { requestRef.current?.abort(); requestRef.current = null; setBusy(false); }}>{t("Cancel", "Hủy")}</Button> : null}</div></div>
    <p className="funnel-ai-status" role="status">{busy ? t("Preparing suggestions. You can keep editing your draft.", "Đang chuẩn bị gợi ý. Bạn vẫn có thể sửa bản nháp.") : applied ? t("Suggestion added to your draft. Review the fields below, then save when ready.", "Đã điền gợi ý vào bản nháp. Xem lại các mục bên dưới rồi lưu khi sẵn sàng.") : result ? t("AI suggestions are possible explanations, not proven causes.", "Gợi ý AI là cách giải thích có thể đúng, chưa phải nguyên nhân đã được chứng minh.") : ""}</p>
    {failure ? <p className="funnel-brief-error" role="alert">{errors[failure] ?? errors.unavailable}</p> : null}
    {result ? <ol className="funnel-ai-results">{result.suggestions.map((suggestion, index) => <li key={index}>
      <h5>{suggestion.hypothesis}</h5>
      <details><summary>{t("Review evidence and proposed test", "Xem dữ liệu và thử nghiệm đề xuất")}</summary><dl>
        <div><dt>{t("Observed evidence", "Dữ liệu đã ghi nhận")}</dt><dd><ul>{Array.from(new Set(suggestion.evidenceIds)).map(key => <li key={key}>{result.evidence.find(item => item.id === key)?.text}</li>)}</ul></dd></div>
        <div><dt>{t("Still needs checking", "Cần kiểm tra thêm")}</dt><dd><ul>{suggestion.missingEvidence.map((item, i) => <li key={i}>{item}</li>)}</ul></dd></div>
        <div><dt>{t("One change to test", "Một thay đổi cần thử")}</dt><dd>{suggestion.change}</dd></div>
        <div><dt>{t("Main success metric", "Chỉ số đánh giá thành công")}</dt><dd>{metricLabel(suggestion.metric)}</dd></div>
        <div><dt>{t("What must not get worse", "Điều không được xấu đi")}</dt><dd>{suggestion.guardrails}</dd></div>
      </dl></details>
      {pending === index ? <div className="funnel-ai-replace"><p>{t("This will replace the four fields in your current draft. Saved versions stay available.", "Thao tác này thay nội dung bốn mục trong bản nháp. Các phiên bản đã lưu vẫn được giữ.")}</p><div className="funnel-ai-actions"><Button type="button" variant="outline" size="sm" onClick={() => apply(index, true)}>{t("Replace draft", "Thay bản nháp")}</Button><Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>{t("Keep my draft", "Giữ bản nháp")}</Button></div></div> : <Button type="button" variant="outline" size="sm" onClick={() => apply(index)}>{t("Use this suggestion", "Dùng gợi ý này")}</Button>}
    </li>)}</ol> : null}
  </section>;
}
