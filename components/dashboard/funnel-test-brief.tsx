"use client";

import * as React from "react";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExperimentWorkspace } from "@/components/dashboard/experiment-workspace";
import { FunnelAiSuggestions } from "@/components/dashboard/funnel-ai-suggestions";
import { funnelMetricLabel } from "@/lib/funnel-analysis";
import { funnelObservationKey, parseFunnelBriefs, type FunnelBriefDraft, type FunnelObservation, type FunnelTestBrief } from "@/lib/funnel-investigation";
import type { InterfaceLanguage } from "@/lib/types";

function metricCopy(metric: FunnelBriefDraft["metric"], language: InterfaceLanguage) {
  const vi = language === "vi";
  const copy = {
    cpa: ["Cost per result (CPA)", "Chi phí mỗi kết quả (CPA)", "Aim to lower the cost of the result you define in the test.", "Mục tiêu là giảm chi phí cho kết quả bạn xác định trong thử nghiệm."],
    cost_per_lead: ["Cost per lead", "Chi phí mỗi lead", "Aim to lower lead cost. Check lead quality separately.", "Mục tiêu là giảm chi phí mỗi lead. Kiểm tra riêng chất lượng lead."],
    roas: ["Return on ad spend (ROAS)", "Doanh thu trên chi tiêu quảng cáo (ROAS)", "Aim to increase measured revenue per unit of ad spend.", "Mục tiêu là tăng doanh thu đo được trên mỗi đơn vị chi quảng cáo."],
    ctr: ["Click-through rate (CTR)", "Tỷ lệ nhấp (CTR)", "Aim to increase click response. Keep the definition of a click consistent.", "Mục tiêu là tăng phản hồi nhấp. Dùng cùng một định nghĩa lượt nhấp."],
    conversion_rate: ["User conversion rate", "Tỷ lệ chuyển đổi người dùng", "Aim to increase the share of eligible users who complete the defined action.", "Mục tiêu là tăng tỷ lệ người dùng đủ điều kiện hoàn thành hành động đã xác định."],
  }[metric];
  return { label: copy[vi ? 1 : 0], description: copy[vi ? 3 : 2] };
}

export function FunnelObservationSummary({ observation, language }: { observation: FunnelObservation; language: InterfaceLanguage }) {
  const t = (en: string, vi: string) => language === "vi" ? vi : en;
  const fmt = (value: number | null) => value === null ? "—" : new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 }).format(value);
  const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: observation.currency, maximumFractionDigits: 0 }).format(value);
  const lowVolume = observation.stage !== "saturation" && observation.current.value !== null && (observation.current.value < 30 || observation.current.denominator !== null && observation.current.denominator < 30);
  const metric = funnelMetricLabel(observation.current.metric, language);
  const measure = (value: FunnelObservation["current"]) => <><strong>{value.rate === null ? fmt(value.value) : `${fmt(value.rate)}%`}</strong><span>{fmt(value.value)} {metric}{value.denominatorKey ? ` / ${fmt(value.denominator)} ${funnelMetricLabel(value.denominatorKey, language)}` : ""}</span></>;
  return <div className="funnel-observation">
    <div className="funnel-finding-heading"><h4>{t("Finding to explain", "Phát hiện cần giải thích")}</h4><span>{observation.source === "sample" ? t("Sample data", "Dữ liệu mẫu") : "Meta"}</span></div>
    <p className="funnel-finding-subject">{observation.segment?.name ?? t("All report results", "Toàn bộ kết quả báo cáo")}<span>{metric}</span></p>
    <dl className="funnel-finding-values">
      <div><dt>{t("Current period", "Kỳ hiện tại")}</dt><dd>{measure(observation.current)}<small>{observation.dates.since} – {observation.dates.until}</small></dd></div>
      <div><dt>{t("Comparison period", "Kỳ so sánh")}</dt><dd>{observation.baseline ? measure(observation.baseline) : <span>{t("No matching comparison data", "Chưa có dữ liệu so sánh tương ứng")}</span>}<small>{observation.baselineDates ? `${observation.baselineDates.since} – ${observation.baselineDates.until}` : "—"}</small></dd></div>
    </dl>
    {lowVolume ? <p className="funnel-finding-caution">{t("Few events: treat this as an early signal, not a reliable conclusion.", "Ít sự kiện: xem đây là tín hiệu ban đầu, chưa đủ để kết luận.")}</p> : null}
    {observation.current.value === null ? <p className="funnel-finding-caution">{t("Measurement is missing. Check tracking before interpreting this result.", "Thiếu phép đo. Kiểm tra theo dõi trước khi diễn giải kết quả.")}</p> : null}
    {observation.stage === "lead" ? <p className="funnel-finding-caution">{t("Lead quality is unknown. Use CRM qualification to assess it.", "Chưa biết chất lượng lead. Cần dữ liệu phân loại từ CRM.")}</p> : null}
    <p className="funnel-finding-note">{t("These counts show what happened, not why. Events may include the same person more than once.", "Các số đếm cho biết điều đã xảy ra, chưa giải thích nguyên nhân. Một người có thể tạo nhiều sự kiện.")}</p>
    <details className="funnel-finding-details"><summary>{t("Data and scope details", "Chi tiết dữ liệu và phạm vi")}<ChevronDownIcon size={14} /></summary><dl>
      <div><dt>{t("Account", "Tài khoản")}</dt><dd>{observation.accountName}</dd></div>
      {observation.scopeCampaigns?.length ? <div><dt>{t("Campaigns", "Chiến dịch")}</dt><dd>{observation.scopeCampaigns.join(" · ")}</dd></div> : null}
      <div><dt>{t("Spend · current / comparison", "Chi tiêu · hiện tại / so sánh")}</dt><dd>{money(observation.spend ?? null)} / {money(observation.baselineSpend ?? null)}</dd></div>
      <div><dt>{t("Cost per event · current / comparison", "Chi phí mỗi sự kiện · hiện tại / so sánh")}</dt><dd>{money(observation.current.cost)} / {money(observation.baseline?.cost ?? null)}</dd></div>
    </dl><p>{t("The saved hypothesis keeps a fixed copy of this evidence. Missing data is shown as —, not as zero.", "Giả thuyết đã lưu giữ nguyên bản dữ liệu này. Dữ liệu thiếu hiển thị bằng —, không phải bằng 0.")}</p></details>
  </div>;
}

export function FunnelTestBriefPanel({ observation, draft, onDraftChange, expanded, onExpandedChange, language }: {
  observation: FunnelObservation;
  draft: FunnelBriefDraft;
  onDraftChange: (draft: FunnelBriefDraft) => void;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  language: InterfaceLanguage;
}) {
  const vi = language === "vi";
  const t = (en: string, vn: string) => vi ? vn : en;
  const [saved, setSaved] = React.useState<FunnelTestBrief[]>([]);
  const [activeBrief, setActiveBrief] = React.useState<FunnelTestBrief | null>(null);
  const [plannerOpen, setPlannerOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [attempted, setAttempted] = React.useState(false);
  const id = React.useId();
  const storageKey = `funnel-test-briefs-v1:${observation.scopeKey}`;
  const observationKey = funnelObservationKey(observation);
  const cleanDraft = { ...draft, hypothesis: draft.hypothesis.trim(), change: draft.change.trim(), guardrails: draft.guardrails.trim() };
  const activeMatches = !!activeBrief && funnelObservationKey(activeBrief.observation) === observationKey && JSON.stringify(activeBrief.draft) === JSON.stringify(cleanDraft);
  React.useEffect(() => {
    try { setSaved(parseFunnelBriefs(window.sessionStorage.getItem(storageKey), observation.scopeKey)); }
    catch { setError(t("Saving is unavailable in this browser. You can still write and plan while this panel stays open.", "Trình duyệt chưa cho phép lưu. Bạn vẫn có thể soạn và lập kế hoạch khi bảng này còn mở.")); }
    setActiveBrief(null);
    setMessage("");
    // Language changes must not discard a prepared hypothesis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  React.useEffect(() => { setActiveBrief(null); setMessage(""); setError(""); setAttempted(false); setPlannerOpen(false); }, [observationKey]);

  function createBrief(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setAttempted(true);
    const missing = (["hypothesis", "change", "guardrails"] as const).find(key => !cleanDraft[key]);
    if (missing) {
      setError(t("Complete the explanation, the change to test and what must not get worse before saving.", "Điền cách giải thích, thay đổi cần thử và điều không được xấu đi trước khi lưu."));
      document.getElementById(`${id}-${missing}`)?.focus();
      return;
    }
    const brief: FunnelTestBrief = { version: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), observation: structuredClone(observation), draft: cleanDraft };
    const revisions = [brief, ...saved].slice(0, 8);
    setSaved(revisions);
    setActiveBrief(brief);
    setAttempted(false);
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(revisions));
      setMessage(t("Hypothesis saved in this tab. You can now plan the test.", "Đã lưu giả thuyết trong tab này. Bạn có thể lập kế hoạch thử nghiệm."));
    } catch {
      setError(t("Could not save in this browser. You can plan this test now, but keep the panel open to retain it.", "Không lưu được trong trình duyệt. Bạn vẫn có thể lập kế hoạch, nhưng cần giữ bảng này mở để giữ nội dung."));
    }
  }

  const hypothesisExample = observation.stage === "lead"
    ? t("A long form may discourage visitors from leaving their details.", "Biểu mẫu dài có thể khiến khách ngại để lại thông tin.")
    : t("The opening message may be less relevant to this audience.", "Thông điệp mở đầu có thể chưa phù hợp với nhóm này.");

  return <section className="plain-panel funnel-brief">
    <h3><button type="button" className="funnel-brief-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => onExpandedChange(!expanded)}><span>{t("Hypothesis", "Giả thuyết")}<small>{expanded ? t("Explain this finding and decide what to test.", "Giải thích phát hiện và xác định điều cần thử.") : t("Save a possible explanation with the evidence, then plan a test.", "Lưu cách giải thích cùng dữ liệu, rồi lập kế hoạch kiểm chứng.")}</small></span><span className="funnel-brief-header-end">{activeMatches ? <span className="funnel-brief-saved"><CheckIcon size={14} />{t("Saved", "Đã lưu")}</span> : null}<ChevronDownIcon size={16} /></span></button></h3>
    <div id={id} hidden={!expanded}>
      {expanded ? <>
        <div className="funnel-brief-body">
          <aside className="funnel-brief-evidence" aria-label={t("Evidence for this hypothesis", "Dữ liệu cho giả thuyết này")}><FunnelObservationSummary observation={observation} language={language} /></aside>
          <form onSubmit={createBrief} noValidate className="funnel-brief-form">
            <div className="funnel-brief-form-intro"><p>{t("A hypothesis is a possible explanation. A test helps you check it.", "Giả thuyết là một cách giải thích có thể đúng. Thử nghiệm giúp bạn kiểm tra điều đó.")}</p><span>{t("All fields required", "Cần điền tất cả các mục")}</span></div>
            <FunnelAiSuggestions key={JSON.stringify([observation, language])} observation={observation} language={language} draft={draft} onApply={next => { onDraftChange(next); setAttempted(false); setError(""); setMessage(""); }} />
            <div className="funnel-brief-field"><label htmlFor={`${id}-hypothesis`}>{t("What could explain this?", "Điều gì có thể giải thích kết quả này?")}</label><p id={`${id}-hypothesis-help`}>{t("Describe one possible cause. Keep it separate from the observed facts.", "Nêu một nguyên nhân có thể xảy ra. Phân biệt với dữ liệu đã ghi nhận.")}</p><textarea id={`${id}-hypothesis`} required aria-invalid={attempted && !cleanDraft.hypothesis} aria-describedby={`${id}-hypothesis-help${attempted && !cleanDraft.hypothesis ? ` ${id}-error` : ""}`} maxLength={2000} rows={3} value={draft.hypothesis} onChange={event => onDraftChange({ ...draft, hypothesis: event.target.value })} placeholder={t(`For example: ${hypothesisExample}`, `Ví dụ: ${hypothesisExample}`)} /></div>
            <div className="funnel-brief-field"><label htmlFor={`${id}-change`}>{t("What will you change?", "Bạn sẽ thay đổi điều gì?")}</label><p id={`${id}-change-help`}>{t("Test one change against the current version so you can interpret the result.", "Thử một thay đổi so với phiên bản hiện tại để có thể diễn giải kết quả.")}</p><textarea id={`${id}-change`} required aria-invalid={attempted && !cleanDraft.change} aria-describedby={`${id}-change-help${attempted && !cleanDraft.change ? ` ${id}-error` : ""}`} maxLength={2000} rows={2} value={draft.change} onChange={event => onDraftChange({ ...draft, change: event.target.value })} placeholder={observation.stage === "lead" ? t("For example: compare a shorter form with the current form.", "Ví dụ: so sánh biểu mẫu ngắn hơn với biểu mẫu hiện tại.") : t("For example: test a new opening message while keeping the offer and audience the same.", "Ví dụ: thử thông điệp mở đầu mới, giữ nguyên ưu đãi và đối tượng.")} /></div>
            <div className="funnel-brief-fields">
              <div className="funnel-brief-field"><label htmlFor={`${id}-metric`}>{t("Main success metric", "Chỉ số đánh giá thành công")}</label><select id={`${id}-metric`} aria-describedby={`${id}-metric-help`} value={draft.metric} onChange={event => onDraftChange({ ...draft, metric: event.target.value as FunnelBriefDraft["metric"] })}>{(["cpa", "cost_per_lead", "roas", "ctr", "conversion_rate"] as const).map(metric => <option key={metric} value={metric}>{metricCopy(metric, language).label}</option>)}</select><p id={`${id}-metric-help`}>{metricCopy(draft.metric, language).description}</p></div>
              <div className="funnel-brief-field"><label htmlFor={`${id}-guardrails`}>{t("What must not get worse?", "Điều gì không được xấu đi?")}</label><input id={`${id}-guardrails`} required aria-invalid={attempted && !cleanDraft.guardrails} aria-describedby={`${id}-guardrails-help${attempted && !cleanDraft.guardrails ? ` ${id}-error` : ""}`} maxLength={1000} value={draft.guardrails} onChange={event => onDraftChange({ ...draft, guardrails: event.target.value })} placeholder={t("For example: lead quality, spend", "Ví dụ: chất lượng lead, chi tiêu")} /><p id={`${id}-guardrails-help`}>{t("Watch these alongside the main metric. They are the test's guardrails.", "Theo dõi cùng chỉ số chính. Đây là các chỉ số bảo vệ của thử nghiệm.")}</p></div>
            </div>
            {error ? <p id={`${id}-error`} role="alert" className="funnel-brief-error">{error}</p> : null}
            {message ? <p role="status" className="funnel-brief-message">{activeMatches ? <><CheckIcon size={15} />{message}</> : t("You have unsaved changes. Save a new version to keep them.", "Có thay đổi chưa lưu. Lưu phiên bản mới để giữ lại.")}</p> : null}
            <div className="funnel-brief-footer"><p>{t("Saving keeps this evidence and your hypothesis together in this tab. It does not start an experiment.", "Lưu giữ dữ liệu này cùng giả thuyết trong tab hiện tại. Thao tác này chưa chạy thử nghiệm.")}</p><div className="funnel-brief-actions">{activeMatches ? <Button type="button" size="sm" onClick={() => setPlannerOpen(true)}>{t("Plan this test", "Lập kế hoạch thử nghiệm")}<ArrowRightIcon size={14} /></Button> : <Button type="submit" size="sm">{activeBrief ? t("Save new version", "Lưu phiên bản mới") : t("Save hypothesis", "Lưu giả thuyết")}<ArrowRightIcon size={14} /></Button>}</div></div>
          </form>
        </div>
        <details className="funnel-saved-briefs"><summary>{t("Saved hypotheses", "Giả thuyết đã lưu")} <span>({saved.length})</span><ChevronDownIcon size={14} /></summary><p>{t("The eight most recent versions for this report. Saved in this tab's browser session; not shared with your team.", "Tối đa tám phiên bản gần nhất của báo cáo này. Chỉ lưu trong phiên của tab hiện tại, chưa chia sẻ với nhóm.")}</p>{saved.length ? <ul>{saved.map(brief => <li key={brief.id}><div><strong>{brief.draft.hypothesis}</strong><small>{brief.observation.segment?.name ?? t("All report results", "Toàn bộ kết quả")} · {metricCopy(brief.draft.metric, language).label} · {new Date(brief.createdAt).toLocaleString(vi ? "vi-VN" : "en-US")}</small></div><button type="button" className="plain-text-action" onClick={() => { setActiveBrief(brief); setPlannerOpen(true); }}>{t("Review and plan", "Xem và lập kế hoạch")}<ArrowRightIcon size={14} /></button></li>)}</ul> : <p>{t("Save your first hypothesis to revisit its evidence and proposed test here.", "Lưu giả thuyết đầu tiên để xem lại dữ liệu và thử nghiệm đề xuất tại đây.")}</p>}</details>
      </> : null}
    </div>
    <Dialog open={plannerOpen} onOpenChange={setPlannerOpen}><DialogContent className="funnel-planner-dialog max-h-[90dvh] overflow-y-auto p-5 sm:max-w-3xl"><DialogHeader><DialogTitle>{t("Plan a test", "Lập kế hoạch thử nghiệm")}</DialogTitle><DialogDescription>{t("Estimate how many observations and days you need. Run the experiment in your testing platform after setup.", "Ước tính số quan sát và số ngày cần có. Chạy thử nghiệm trên nền tảng của bạn sau khi thiết lập.")}</DialogDescription></DialogHeader>
      {activeBrief ? <><details className="funnel-planner-context"><summary>{t("Saved hypothesis and evidence", "Giả thuyết và dữ liệu đã lưu")}<ChevronDownIcon size={14} /></summary><div><p><b>{t("Possible explanation", "Cách giải thích có thể đúng")}</b>{activeBrief.draft.hypothesis}</p><p><b>{t("Change to test", "Thay đổi cần thử")}</b>{activeBrief.draft.change}</p><FunnelObservationSummary observation={activeBrief.observation} language={language} /></div></details><ExperimentWorkspace key={activeBrief.id} language={language} initialBrief={activeBrief} planningOnly /></> : null}
    </DialogContent></Dialog>
  </section>;
}
