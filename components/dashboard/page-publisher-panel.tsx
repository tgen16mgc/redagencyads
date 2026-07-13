"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  Clock3Icon,
  FileTextIcon,
  ImageIcon,
  InstagramIcon,
  LinkIcon,
  ListPlusIcon,
  PlusIcon,
  RefreshCcwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE, type InterfaceLanguage, type MediaAttachment, type MetaPage, type PagePostMode, type PagePostSubmission, type PublishTarget } from "@/lib/types";
import {
  getSchedulePresetDateTimeLocal,
  validatePagePostDraft,
  type PagePostValidationMessages,
  type SchedulePreset,
} from "@/lib/page-publisher-validation";
import { StickyActionDock } from "@/components/dashboard/sticky-action-dock";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ScheduleQueueItem = {
  id: string;
  pageId: string;
  pageName: string;
  message: string;
  link: string;
  scheduledFor: string;
  target: PublishTarget;
  mediaItems: MediaAttachment[];
};

type Copy = {
  title: string;
  description: string;
  pageLabel: string;
  pagePlaceholder: string;
  pageHelp: string;
  refreshPages: string;
  targetLabel: string;
  facebook: string;
  instagram: string;
  both: string;
  messageLabel: string;
  messagePlaceholder: string;
  linkLabel: string;
  linkPlaceholder: string;
  mediaLabel: string;
  mediaHelp: string;
  mediaType: string;
  mediaUrl: string;
  mediaFile: string;
  addMedia: string;
  mediaListEmpty: string;
  moveUp: string;
  moveDown: string;
  removeMedia: string;
  modeLabel: string;
  publishNow: string;
  scheduled: string;
  scheduleLabel: string;
  scheduleHelp: string;
  addToQueue: string;
  queueTitle: string;
  queueDescription: string;
  queueEmpty: string;
  submit: string;
  submitQueue: string;
  review: string;
  confirm: string;
  cancel: string;
  confirmTitle: string;
  confirmDescription: string;
  permissionSummary: string;
  submitting: string;
  loadingPages: string;
  noPagesTitle: string;
  noPagesDescription: string;
  successTitle: string;
  successDescription: string;
  recentTitle: string;
  recentDescription: string;
  recentEmptyTitle: string;
  recentEmptyDescription: string;
  pageColumn: string;
  targetColumn: string;
  statusColumn: string;
  timeColumn: string;
  previewTitle: string;
  previewDescription: string;
  previewEmpty: string;
  capabilityTitle: string;
  capabilityDescription: string;
  ready: string;
  needsSetup: string;
  missing: string;
  linked: string;
  notLinked: string;
  mediaPreview: string;
  textPost: string;
  linkPost: string;
  presetIn1Hour: string;
  presetTomorrowMorning: string;
  presetTomorrowAfternoon: string;
  presetNextWeekdayMorning: string;
  presetNextWeekdayAfternoon: string;
  pagesLoadFailed: string;
  publishFailed: string;
  queueValidation: string;
  queueFileMediaUnsupported: string;
  validation: PagePostValidationMessages;
};

const COPY: Record<InterfaceLanguage, Copy> = {
  en: {
    title: "Page publisher",
    description: "Preview, publish, or queue Facebook and Instagram posts with Meta permissions checked on the server.",
    pageLabel: "Facebook Page",
    pagePlaceholder: "Choose a Page",
    pageHelp: "Only Pages where your token has content creation permissions are shown.",
    refreshPages: "Refresh Pages",
    targetLabel: "Publish to",
    facebook: "Facebook",
    instagram: "Instagram",
    both: "Both",
    messageLabel: "Post message",
    messagePlaceholder: "Write the post copy...",
    linkLabel: "Optional link",
    linkPlaceholder: "https://example.com/landing-page",
    mediaLabel: "Media attachments",
    mediaHelp: "Facebook supports multiple images/GIFs. Instagram and Both support one media item here.",
    mediaType: "Media type",
    mediaUrl: "Hosted media URL",
    mediaFile: "Upload media files",
    addMedia: "Add media",
    mediaListEmpty: "No media added yet.",
    moveUp: "Move up",
    moveDown: "Move down",
    removeMedia: "Remove media",
    modeLabel: "Publishing mode",
    publishNow: "Publish now",
    scheduled: "Schedule",
    scheduleLabel: "Schedule time",
    scheduleHelp: "Meta requires scheduled posts to be at least 10 minutes in the future.",
    addToQueue: "Add to schedule queue",
    queueTitle: "Schedule queue",
    queueDescription: "Build a small batch with preset times, then submit all rows together.",
    queueEmpty: "No scheduled posts queued yet.",
    submit: "Submit post",
    submitQueue: "Submit queued posts",
    review: "Review Page post",
    confirm: "Confirm and submit",
    cancel: "Keep editing",
    confirmTitle: "Review before sending",
    confirmDescription: "Confirm the destination, publishing mode, and visible post content.",
    permissionSummary: "This Page came from the server-filtered list of Pages available to the current Meta session.",
    submitting: "Submitting",
    loadingPages: "Loading Pages",
    noPagesTitle: "No content-ready Pages",
    noPagesDescription: "Reconnect with a Meta token that can create content on at least one Facebook Page.",
    successTitle: "Submitted to Meta",
    successDescription: "Meta post ID",
    recentTitle: "Recent submissions",
    recentDescription: "This list is stored in this browser. Server audit history remains a future backend step.",
    recentEmptyTitle: "No Page posts submitted yet",
    recentEmptyDescription: "Published and scheduled submissions will appear here after Meta accepts them.",
    pageColumn: "Page",
    targetColumn: "Target",
    statusColumn: "Status",
    timeColumn: "Time",
    previewTitle: "Post preview",
    previewDescription: "What the selected Page and media will look like before submitting.",
    previewEmpty: "Write copy or add media to preview the post.",
    capabilityTitle: "Selected Page readiness",
    capabilityDescription: "Tokens stay server-side; this shows what the server can verify for the chosen Page.",
    ready: "Ready",
    needsSetup: "Needs setup",
    missing: "Missing",
    linked: "Linked",
    notLinked: "Not linked",
    mediaPreview: "Media preview",
    textPost: "Text",
    linkPost: "Link",
    presetIn1Hour: "In 1 hour",
    presetTomorrowMorning: "Tomorrow 9:00",
    presetTomorrowAfternoon: "Tomorrow 14:00",
    presetNextWeekdayMorning: "Next weekday 9:00",
    presetNextWeekdayAfternoon: "Next weekday 14:00",
    pagesLoadFailed: "Unable to load Pages.",
    publishFailed: "Unable to submit post.",
    queueValidation: "Switch to Schedule and choose a time before adding to the queue.",
    queueFileMediaUnsupported: "Queued scheduled posts can only use hosted media URLs. Submit uploaded files directly instead.",
    validation: {
      pageRequired: "Choose a Page before publishing.",
      contentRequired: "Add a message, link, or media before publishing.",
      scheduleRequired: "Choose a schedule time.",
      scheduleTooSoon: "Schedule time must be at least 10 minutes in the future.",
      instagramMediaRequired: "Instagram posts require an image, video, or GIF attachment.",
      instagramScheduleUnsupported: "Instagram scheduling is not available here yet; use Facebook or publish now.",
      multipleMediaInstagramUnsupported: "Multiple media attachments are only supported for Facebook posts right now.",
      multipleVideoUnsupported: "Multiple media Facebook posts can only use images or GIFs.",
    },
  },
  vi: {
    title: "Đăng bài Page",
    description: "Xem trước, đăng ngay hoặc lên lịch bài Facebook và Instagram với quyền Meta được kiểm tra trên server.",
    pageLabel: "Facebook Page",
    pagePlaceholder: "Chọn Page",
    pageHelp: "Chỉ hiển thị Page mà token hiện tại có quyền tạo nội dung.",
    refreshPages: "Tải lại Page",
    targetLabel: "Đăng lên",
    facebook: "Facebook",
    instagram: "Instagram",
    both: "Cả hai",
    messageLabel: "Nội dung bài đăng",
    messagePlaceholder: "Viết copy cho bài đăng...",
    linkLabel: "Link tùy chọn",
    linkPlaceholder: "https://example.com/landing-page",
    mediaLabel: "Media đính kèm",
    mediaHelp: "Facebook hỗ trợ nhiều ảnh/GIF. Instagram và Cả hai hiện chỉ hỗ trợ một media trong tool này.",
    mediaType: "Loại media",
    mediaUrl: "URL media public",
    mediaFile: "Tải file media lên",
    addMedia: "Thêm media",
    mediaListEmpty: "Chưa thêm media nào.",
    moveUp: "Đưa lên",
    moveDown: "Đưa xuống",
    removeMedia: "Xóa media",
    modeLabel: "Chế độ đăng",
    publishNow: "Đăng ngay",
    scheduled: "Lên lịch",
    scheduleLabel: "Thời gian lên lịch",
    scheduleHelp: "Meta yêu cầu bài lên lịch phải cách hiện tại ít nhất 10 phút.",
    addToQueue: "Thêm vào hàng chờ",
    queueTitle: "Hàng chờ lên lịch",
    queueDescription: "Tạo một batch nhỏ bằng preset thời gian rồi gửi toàn bộ cùng lúc.",
    queueEmpty: "Chưa có bài lên lịch nào trong hàng chờ.",
    submit: "Gửi bài đăng",
    submitQueue: "Gửi hàng chờ",
    review: "Xem lại bài Page",
    confirm: "Xác nhận và gửi",
    cancel: "Tiếp tục chỉnh sửa",
    confirmTitle: "Xem lại trước khi gửi",
    confirmDescription: "Xác nhận Page đích, chế độ đăng và nội dung hiển thị.",
    permissionSummary: "Page này nằm trong danh sách đã được server lọc theo Meta session hiện tại.",
    submitting: "Đang gửi",
    loadingPages: "Đang tải Page",
    noPagesTitle: "Không có Page đủ quyền đăng",
    noPagesDescription: "Kết nối lại bằng Meta token có quyền tạo nội dung trên ít nhất một Facebook Page.",
    successTitle: "Đã gửi lên Meta",
    successDescription: "Meta post ID",
    recentTitle: "Lần gửi gần đây",
    recentDescription: "Danh sách được lưu trong trình duyệt này. Audit history trên server vẫn là bước backend tiếp theo.",
    recentEmptyTitle: "Chưa gửi bài Page nào",
    recentEmptyDescription: "Bài đăng ngay và bài lên lịch sẽ xuất hiện ở đây sau khi Meta chấp nhận.",
    pageColumn: "Page",
    targetColumn: "Kênh",
    statusColumn: "Trạng thái",
    timeColumn: "Thời gian",
    previewTitle: "Xem trước bài đăng",
    previewDescription: "Kiểm tra Page, nội dung và media trước khi gửi.",
    previewEmpty: "Viết nội dung hoặc thêm media để xem preview.",
    capabilityTitle: "Mức sẵn sàng của Page",
    capabilityDescription: "Token vẫn ở server; phần này hiển thị những gì server xác minh được.",
    ready: "Sẵn sàng",
    needsSetup: "Cần thiết lập",
    missing: "Thiếu",
    linked: "Đã liên kết",
    notLinked: "Chưa liên kết",
    mediaPreview: "Xem trước media",
    textPost: "Text",
    linkPost: "Link",
    presetIn1Hour: "Sau 1 giờ",
    presetTomorrowMorning: "Mai 9:00",
    presetTomorrowAfternoon: "Mai 14:00",
    presetNextWeekdayMorning: "Ngày làm việc kế 9:00",
    presetNextWeekdayAfternoon: "Ngày làm việc kế 14:00",
    pagesLoadFailed: "Không tải được Page.",
    publishFailed: "Không gửi được bài đăng.",
    queueValidation: "Chuyển sang Lên lịch và chọn thời gian trước khi thêm vào hàng chờ.",
    queueFileMediaUnsupported: "Bài trong hàng chờ chỉ hỗ trợ URL media public. Hãy gửi trực tiếp nếu dùng file upload.",
    validation: {
      pageRequired: "Chọn Page trước khi đăng.",
      contentRequired: "Thêm nội dung, link hoặc media trước khi đăng.",
      scheduleRequired: "Chọn thời gian lên lịch.",
      scheduleTooSoon: "Thời gian lên lịch phải sau hiện tại ít nhất 10 phút.",
      instagramMediaRequired: "Bài Instagram cần ảnh, video hoặc GIF.",
      instagramScheduleUnsupported: "Chưa hỗ trợ lên lịch Instagram ở đây; hãy dùng Facebook hoặc đăng ngay.",
      multipleMediaInstagramUnsupported: "Nhiều media hiện chỉ hỗ trợ cho bài Facebook.",
      multipleVideoUnsupported: "Bài Facebook nhiều media chỉ dùng ảnh hoặc GIF.",
    },
  },
};

const SCHEDULE_PRESETS: Array<{ key: SchedulePreset; copyKey: keyof Pick<Copy, "presetIn1Hour" | "presetTomorrowMorning" | "presetTomorrowAfternoon" | "presetNextWeekdayMorning" | "presetNextWeekdayAfternoon"> }> = [
  { key: "in_1_hour", copyKey: "presetIn1Hour" },
  { key: "tomorrow_morning", copyKey: "presetTomorrowMorning" },
  { key: "tomorrow_afternoon", copyKey: "presetTomorrowAfternoon" },
  { key: "next_weekday_morning", copyKey: "presetNextWeekdayMorning" },
  { key: "next_weekday_afternoon", copyKey: "presetNextWeekdayAfternoon" },
];

const SUBMISSION_STORAGE_KEY = "decision-workspace-page-submissions";
const DRAFT_STORAGE_KEY = "decision-workspace-page-draft";

type PublisherDraft = {
  pageId: string;
  message: string;
  link: string;
  mode: PagePostMode;
  scheduledFor: string;
};

function readPublisherDraft(): PublisherDraft {
  const fallback: PublisherDraft = { pageId: "", message: "", link: "", mode: "publish_now", scheduledFor: "" };
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || "null") as Partial<PublisherDraft> | null;
    if (!parsed) return fallback;
    return {
      pageId: typeof parsed.pageId === "string" ? parsed.pageId : "",
      message: typeof parsed.message === "string" ? parsed.message : "",
      link: typeof parsed.link === "string" ? parsed.link : "",
      mode: parsed.mode === "scheduled" ? "scheduled" : "publish_now",
      scheduledFor: typeof parsed.scheduledFor === "string" ? parsed.scheduledFor : "",
    };
  } catch {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    return fallback;
  }
}

export function PagePublisherPanel({ language }: { language: InterfaceLanguage }) {
  const copy = COPY[language];
  const id = React.useId();
  const initialDraft = React.useMemo(readPublisherDraft, []);
  const [pages, setPages] = React.useState<MetaPage[]>([]);
  const [pageId, setPageId] = React.useState(initialDraft.pageId);
  const [target, setTarget] = React.useState<PublishTarget>("facebook");
  const [message, setMessage] = React.useState(initialDraft.message);
  const [link, setLink] = React.useState(initialDraft.link);
  const [mediaType, setMediaType] = React.useState<MediaAttachment["type"]>("image");
  const [mediaUrl, setMediaUrl] = React.useState("");
  const [mediaItems, setMediaItems] = React.useState<MediaAttachment[]>([]);
  const [mode, setMode] = React.useState<PagePostMode>(initialDraft.mode);
  const [scheduledFor, setScheduledFor] = React.useState(initialDraft.scheduledFor);
  const [queue, setQueue] = React.useState<ScheduleQueueItem[]>([]);
  const [loadingPages, setLoadingPages] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState<PagePostSubmission | null>(null);
  const [submissions, setSubmissions] = React.useState<PagePostSubmission[]>([]);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const selectedPage = pages.find((page) => page.id === pageId);
  const draftValidation = validatePagePostDraft({ pageId, message, link, mode, scheduledFor, target, mediaItems }, Date.now(), copy.validation);
  const canReview = pages.length > 0 && !loadingPages && !submitting && !draftValidation;

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SUBMISSION_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) setSubmissions(parsed.slice(0, 6) as PagePostSubmission[]);
    } catch {
      window.localStorage.removeItem(SUBMISSION_STORAGE_KEY);
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ pageId, message, link, mode, scheduledFor }));
  }, [link, message, mode, pageId, scheduledFor]);

  const hasPreview = Boolean(message.trim() || link.trim() || mediaItems.length);

  const loadPages = React.useCallback(async () => {
    setLoadingPages(true);
    setError("");
    try {
      const response = await fetch("/api/meta/pages");
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || copy.pagesLoadFailed);
      const nextPages = (json.pages || []) as MetaPage[];
      setPages(nextPages);
      setPageId((current) => nextPages.some((page) => page.id === current) ? current : nextPages[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.pagesLoadFailed);
    } finally {
      setLoadingPages(false);
    }
  }, [copy.pagesLoadFailed]);

  React.useEffect(() => {
    void loadPages();
  }, [loadPages]);

  function reviewPost() {
    setError("");
    setSuccess(null);

    const validation = validatePagePostDraft({ pageId, message, link, mode, scheduledFor, target, mediaItems }, Date.now(), copy.validation);
    if (validation) {
      setError(validation);
      return;
    }

    setConfirmOpen(true);
  }

  async function submitPost() {
    setConfirmOpen(false);

    setSubmitting(true);
    try {
      const response = await fetch("/api/meta/page-posts", {
        method: "POST",
        body: buildSubmitBody({ pageId, message, link, mode, scheduledFor, target, mediaItems }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || copy.publishFailed);
      const submission = json.submission as PagePostSubmission;
      setSuccess(submission);
      setSubmissions((current) => {
        const next = [submission, ...current].slice(0, 8);
        window.localStorage.setItem(SUBMISSION_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      resetDraft(mode === "scheduled");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.publishFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function addHostedMedia() {
    const next = buildHostedMedia(mediaType, mediaUrl);
    if (!next) return;
    setMediaItems((current) => [...current, next]);
    setMediaUrl("");
  }

  function addMediaFiles(files: FileList | null) {
    if (!files?.length) return;
    setMediaItems((current) => [...current, ...Array.from(files).map(fileToMedia)]);
  }

  function moveMedia(index: number, direction: -1 | 1) {
    setMediaItems((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function addToQueue() {
    setError("");
    setSuccess(null);
    if (mode !== "scheduled") {
      setError(copy.queueValidation);
      return;
    }
    const validation = validatePagePostDraft({ pageId, message, link, mode, scheduledFor, target, mediaItems }, Date.now(), copy.validation);
    if (validation) {
      setError(validation);
      return;
    }
    if (mediaItems.some((item) => item.file)) {
      setError(copy.queueFileMediaUnsupported);
      return;
    }
    setQueue((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        pageId,
        pageName: selectedPage?.name || pageId,
        message,
        link,
        scheduledFor: new Date(scheduledFor).toISOString(),
        target,
        mediaItems,
      },
    ]);
    resetDraft(true);
  }

  async function submitQueue() {
    if (!queue.length) return;
    setError("");
    setSuccess(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/meta/page-posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: queue.map((item) => ({
            pageId: item.pageId,
            message: item.message.trim() || undefined,
            link: item.link.trim() || undefined,
            mode: "scheduled",
            scheduledFor: item.scheduledFor,
            target: item.target,
            mediaItems: item.mediaItems.length ? item.mediaItems : undefined,
          })),
        }),
      });
      const json = await response.json();
      const results = (json.results || []) as Array<{ ok: boolean; submission?: PagePostSubmission; error?: string }>;
      if (!response.ok && !results.length) throw new Error(json.error || copy.publishFailed);
      const accepted = results.flatMap((result) => (result.submission ? [result.submission] : []));
      if (accepted.length) setSubmissions((current) => [...accepted, ...current].slice(0, 8));
      const failed = results.filter((result) => !result.ok).map((result) => result.error).filter(Boolean);
      setQueue((current) => current.filter((_, index) => !results[index]?.ok));
      if (failed.length) setError(failed.join(" "));
      else setSuccess(accepted[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.publishFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function resetDraft(keepScheduleMode = false) {
    setMessage("");
    setLink("");
    setMediaUrl("");
    setMediaItems([]);
    setScheduledFor("");
    if (!keepScheduleMode) setMode("publish_now");
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <Card className="workbench-fade-up overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{copy.title}</CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={loadPages} disabled={loadingPages}>
              {loadingPages ? <Spinner data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
              {copy.refreshPages}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{language === "vi" ? "Cần kiểm tra" : "Needs attention"}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert className="border-success/30 bg-success/10 text-success">
              <CheckCircle2Icon />
              <AlertTitle>{copy.successTitle}</AlertTitle>
              <AlertDescription className="text-success/90">
                {copy.successDescription}: {success.metaPostId}
              </AlertDescription>
            </Alert>
          ) : null}

          {!loadingPages && pages.length === 0 ? (
            <Empty className="min-h-72 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>{copy.noPagesTitle}</EmptyTitle>
                <EmptyDescription>{copy.noPagesDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                reviewPost();
              }}
              className="flex flex-col gap-4"
            >
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel id={`${id}-page-label`}>{copy.pageLabel}</FieldLabel>
                  <Select
                    items={pages.map((page) => ({ label: page.name, value: page.id }))}
                    value={pageId}
                    onValueChange={(value) => {
                      if (value) setPageId(value);
                    }}
                  >
                    <SelectTrigger className="w-full" disabled={loadingPages} aria-labelledby={`${id}-page-label`}>
                      <SelectValue placeholder={loadingPages ? copy.loadingPages : copy.pagePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {pages.map((page) => (
                          <SelectItem key={page.id} value={page.id}>
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate">{page.name}</span>
                              {page.category ? <span className="text-xs text-muted-foreground">{page.category}</span> : null}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{copy.pageHelp}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>{copy.targetLabel}</FieldLabel>
                  <ToggleGroup
                    aria-label={copy.targetLabel}
                    value={[target]}
                    onValueChange={(values) => {
                      const next = values.find((value): value is PublishTarget => value === "facebook" || value === "instagram" || value === "both");
                      if (next) setTarget(next);
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                  >
                    <ToggleGroupItem value="facebook">{copy.facebook}</ToggleGroupItem>
                    <ToggleGroupItem value="instagram">{copy.instagram}</ToggleGroupItem>
                    <ToggleGroupItem value="both">{copy.both}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                <Field className="md:col-span-2">
                  <FieldLabel htmlFor={`${id}-message`}>{copy.messageLabel}</FieldLabel>
                  <Textarea
                    id={`${id}-message`}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={copy.messagePlaceholder}
                    rows={6}
                  />
                </Field>

                <Field className="md:col-span-2">
                  <FieldLabel htmlFor={`${id}-link`}>{copy.linkLabel}</FieldLabel>
                  <Input id={`${id}-link`} type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder={copy.linkPlaceholder} />
                </Field>

                <Field>
                  <FieldLabel>{copy.mediaType}</FieldLabel>
                  <Select value={mediaType} onValueChange={(value) => setMediaType(value as MediaAttachment["type"])}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="gif">GIF</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{copy.mediaHelp}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>{copy.mediaUrl}</FieldLabel>
                  <div className="flex gap-2">
                    <Input type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://cdn.example.com/media.jpg" />
                    <Button type="button" variant="outline" onClick={addHostedMedia} disabled={!mediaUrl.trim()}>
                      <PlusIcon data-icon="inline-start" />
                      {copy.addMedia}
                    </Button>
                  </div>
                </Field>

                <Field className="md:col-span-2">
                  <FieldLabel>{copy.mediaFile}</FieldLabel>
                  <Input
                    type="file"
                    accept="image/*,video/*,.gif"
                    multiple
                    onChange={(event) => {
                      addMediaFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <FieldDescription>{copy.mediaHelp}</FieldDescription>
                </Field>

                <Field className="md:col-span-2">
                  <FieldLabel>{copy.mediaLabel}</FieldLabel>
                  <MediaList copy={copy} mediaItems={mediaItems} onMove={moveMedia} onRemove={(index) => setMediaItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                </Field>

                <Field>
                  <FieldLabel>{copy.modeLabel}</FieldLabel>
                  <ToggleGroup
                    aria-label={copy.modeLabel}
                    value={[mode]}
                    onValueChange={(values) => {
                      const next = values.find((value): value is PagePostMode => value === "publish_now" || value === "scheduled");
                      if (next) setMode(next);
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                  >
                    <ToggleGroupItem value="publish_now">{copy.publishNow}</ToggleGroupItem>
                    <ToggleGroupItem value="scheduled">{copy.scheduled}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                {mode === "scheduled" ? (
                  <Field>
                    <FieldLabel htmlFor={`${id}-schedule`}>{copy.scheduleLabel}</FieldLabel>
                    <Input id={`${id}-schedule`} type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
                    <FieldDescription>{copy.scheduleHelp}</FieldDescription>
                  </Field>
                ) : null}
              </FieldGroup>

              {mode === "scheduled" ? (
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_PRESETS.map((preset) => (
                    <Button key={preset.key} type="button" variant="outline" size="sm" onClick={() => setScheduledFor(getSchedulePresetDateTimeLocal(preset.key))}>
                      <Clock3Icon data-icon="inline-start" />
                      {copy[preset.copyKey]}
                    </Button>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={!canReview} className="w-full sm:w-fit">
                  {submitting ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
                  {submitting ? copy.submitting : copy.review}
                </Button>
                {mode === "scheduled" ? (
                  <Button type="button" variant="outline" disabled={submitting || loadingPages || pages.length === 0} onClick={addToQueue}>
                    <ListPlusIcon data-icon="inline-start" />
                    {copy.addToQueue}
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="border-border bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileTextIcon className="size-4 text-muted-foreground" />
              {copy.previewTitle}
            </CardTitle>
            <CardDescription>{copy.previewDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasPreview ? (
              <div className="rounded-xl border bg-background p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{selectedPage?.name || copy.pagePlaceholder}</p>
                    <p className="text-xs text-muted-foreground">{targetLabel(target, copy)}</p>
                  </div>
                  <TargetBadges target={target} copy={copy} />
                </div>
                {message.trim() ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{message}</p> : null}
                {link.trim() ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <LinkIcon className="size-4" />
                    <span className="truncate">{link}</span>
                  </div>
                ) : null}
                {mediaItems.length ? <MediaPreview copy={copy} mediaItems={mediaItems} /> : null}
              </div>
            ) : (
              <Empty className="min-h-48 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageIcon />
                  </EmptyMedia>
                  <EmptyDescription>{copy.previewEmpty}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <InstagramIcon className="size-4 text-muted-foreground" />
              {copy.capabilityTitle}
            </CardTitle>
            <CardDescription>{copy.capabilityDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <CapabilitySummary page={selectedPage} copy={copy} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClockIcon className="size-4 text-muted-foreground" />
              {copy.queueTitle}
            </CardTitle>
            <CardDescription>{copy.queueDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {queue.length ? (
              <>
                <div className="space-y-2">
                  {queue.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{item.pageName}</p>
                          <TargetBadges target={item.target} copy={copy} />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{item.message || item.link || item.mediaItems[0]?.name || item.mediaItems[0]?.url}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.scheduledFor, language)}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setQueue((current) => current.filter((queued) => queued.id !== item.id))}>
                        <Trash2Icon className="size-4" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" onClick={submitQueue} disabled={submitting}>
                  {submitting ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
                  {copy.submitQueue}
                </Button>
              </>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{copy.queueEmpty}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.recentTitle}</CardTitle>
            <CardDescription>{copy.recentDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.pageColumn}</TableHead>
                    <TableHead>{copy.targetColumn}</TableHead>
                    <TableHead>{copy.statusColumn}</TableHead>
                    <TableHead>{copy.timeColumn}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={`${submission.metaPostId}-${submission.createdAt}`}>
                      <TableCell className="max-w-40 truncate font-medium">{submission.pageName}</TableCell>
                      <TableCell>
                        <TargetBadges target={submission.target || "facebook"} copy={copy} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={submission.status === "scheduled" ? "secondary" : "success"}>{submission.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatSubmissionTime(submission, language)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty className="min-h-44 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SendIcon />
                  </EmptyMedia>
                  <EmptyTitle>{copy.recentEmptyTitle}</EmptyTitle>
                  <EmptyDescription>{copy.recentEmptyDescription}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/25 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">{copy.pageLabel}</span>
              <span className="text-right font-medium">{selectedPage?.name || copy.pagePlaceholder}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">{copy.modeLabel}</span>
              <span className="text-right font-medium">{mode === "scheduled" ? copy.scheduled : copy.publishNow}</span>
            </div>
            {mode === "scheduled" ? (
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">{copy.scheduleLabel}</span>
                <span className="text-right font-medium">{scheduledFor ? new Date(scheduledFor).toLocaleString(language === "vi" ? "vi-VN" : "en-US") : "—"}</span>
              </div>
            ) : null}
            <div className="rounded-lg border bg-background p-3 leading-6">
              {message.trim() || <span className="text-muted-foreground">{copy.textPost}: —</span>}
              {link.trim() ? <div className="mt-2 break-all text-primary">{link.trim()}</div> : null}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{copy.permissionSummary}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitPost()} disabled={submitting}>
              {submitting ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
              {submitting ? copy.submitting : copy.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StickyActionDock
        contextLabel={copy.title}
        status={loadingPages || submitting ? "working" : canReview ? "ready" : "blocked"}
        statusLabel={loadingPages
          ? copy.loadingPages
          : submitting
            ? copy.submitting
            : canReview
              ? copy.review
              : draftValidation || copy.noPagesTitle}
        primaryAction={{
          id: "review-page-post",
          label: copy.review,
          shortLabel: copy.review,
          icon: SendIcon,
          onSelect: reviewPost,
          disabled: !canReview,
          disabledReason: draftValidation || (pages.length ? undefined : copy.noPagesDescription),
          loading: loadingPages || submitting,
          shortcut: "mod+enter",
        }}
        secondaryActions={[{
          id: "refresh-pages",
          label: copy.refreshPages,
          icon: RefreshCcwIcon,
          onSelect: loadPages,
          disabled: loadingPages || submitting,
          loading: loadingPages,
        }]}
        actionsLabel={language === "vi" ? "Hành động khác" : "More actions"}
      />
    </section>
  );
}

function buildHostedMedia(type: MediaAttachment["type"], url: string): MediaAttachment | undefined {
  if (url.trim()) return { type, url: url.trim() };
  return undefined;
}

function fileToMedia(file: File): MediaAttachment {
  if (file.type.startsWith("video/")) return { type: "video", name: file.name, file };
  if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) return { type: "gif", name: file.name, file };
  return { type: "image", name: file.name, file };
}

function mediaLabel(media: MediaAttachment) {
  return media.name || media.url || media.type;
}

function clientMedia(mediaItems: MediaAttachment[]) {
  return mediaItems.map((item) => ({ type: item.type, url: item.url, name: item.name }));
}

function buildSubmitBody(input: {
  pageId: string;
  message: string;
  link: string;
  mode: PagePostMode;
  scheduledFor: string;
  target: PublishTarget;
  mediaItems: MediaAttachment[];
}) {
  if (input.mediaItems.some((item) => item.file)) {
    const formData = new FormData();
    const metadata = [];
    let fileIndex = 0;
    formData.set("pageId", input.pageId);
    formData.set("message", input.message.trim());
    formData.set("link", input.link.trim());
    formData.set("mode", input.mode);
    formData.set("target", input.target);
    if (input.mode === "scheduled") formData.set("scheduledFor", new Date(input.scheduledFor).toISOString());
    for (const item of input.mediaItems) {
      if (item.file) {
        formData.append("mediaFiles", item.file);
        metadata.push({ type: item.type, name: item.name, fileIndex });
        fileIndex += 1;
      } else {
        metadata.push({ type: item.type, url: item.url, name: item.name });
      }
    }
    formData.set("mediaItems", JSON.stringify(metadata));
    return formData;
  }

  return JSON.stringify({
    pageId: input.pageId,
    message: input.message.trim() || undefined,
    link: input.link.trim() || undefined,
    mode: input.mode,
    scheduledFor: input.mode === "scheduled" ? new Date(input.scheduledFor).toISOString() : undefined,
    target: input.target,
    mediaItems: input.mediaItems.length ? clientMedia(input.mediaItems) : undefined,
  });
}

function TargetBadges({ target, copy }: { target: PublishTarget; copy: Copy }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(target === "facebook" || target === "both") ? <Badge variant="secondary">{copy.facebook}</Badge> : null}
      {(target === "instagram" || target === "both") ? <Badge variant="outline">{copy.instagram}</Badge> : null}
    </div>
  );
}

function CapabilitySummary({ page, copy }: { page?: MetaPage; copy: Copy }) {
  if (!page) return <p className="text-sm text-muted-foreground">{copy.pagePlaceholder}</p>;
  const facebook = page.capabilities?.facebook;
  const instagram = page.capabilities?.instagram;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>{copy.facebook}</span>
        <Badge variant={facebook?.canPublish ? "success" : "destructive"}>{facebook?.canPublish ? copy.ready : copy.needsSetup}</Badge>
      </div>
      {facebook?.missingPermissions?.length ? <p className="text-xs text-muted-foreground">{copy.missing}: {facebook.missingPermissions.join(", ")}</p> : null}
      {!facebook?.canPublish ? <p className="text-xs text-muted-foreground">{FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE}</p> : null}
      {facebook?.issues?.length ? <p className="text-xs text-muted-foreground">{facebook.issues.join(" ")}</p> : null}
      <Separator />
      <div className="flex items-center justify-between gap-3">
        <span>{copy.instagram}</span>
        <Badge variant={instagram?.canPublish ? "success" : "outline"}>{instagram?.canPublish ? copy.ready : copy.needsSetup}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{instagram?.accountId ? `${copy.linked}: ${instagram.username || instagram.accountId}` : copy.notLinked}</p>
      {instagram?.missingPermissions?.length ? <p className="text-xs text-muted-foreground">{copy.missing}: {instagram.missingPermissions.join(", ")}</p> : null}
    </div>
  );
}

function MediaList({
  copy,
  mediaItems,
  onMove,
  onRemove,
}: {
  copy: Copy;
  mediaItems: MediaAttachment[];
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  if (!mediaItems.length) return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{copy.mediaListEmpty}</p>;
  return (
    <div className="space-y-2 rounded-lg border p-2">
      {mediaItems.map((media, index) => (
        <div key={`${mediaLabel(media)}-${index}`} className="flex items-center gap-2 rounded-md bg-muted/40 p-2">
          <Badge variant="outline">#{index + 1}</Badge>
          <ImageIcon className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm">{mediaLabel(media)}</span>
          <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(index, -1)}>
            <ArrowUpIcon className="size-4" />
            <span className="sr-only">{copy.moveUp}</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={index === mediaItems.length - 1} onClick={() => onMove(index, 1)}>
            <ArrowDownIcon className="size-4" />
            <span className="sr-only">{copy.moveDown}</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
            <Trash2Icon className="size-4" />
            <span className="sr-only">{copy.removeMedia}</span>
          </Button>
        </div>
      ))}
    </div>
  );
}

function MediaPreview({ copy, mediaItems }: { copy: Copy; mediaItems: MediaAttachment[] }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {mediaItems.map((media, index) => (
        <div key={`${mediaLabel(media)}-${index}`} className="overflow-hidden rounded-lg border bg-muted/40">
          {media.url && (media.type === "image" || media.type === "gif") ? (
            <img src={media.url} alt={`${copy.mediaPreview} ${index + 1}`} className="max-h-64 w-full object-cover" />
          ) : (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Badge variant="outline">#{index + 1}</Badge>
              <ImageIcon className="size-4" />
              <span className="truncate">{mediaLabel(media)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function targetLabel(target: PublishTarget, copy: Copy) {
  if (target === "both") return copy.both;
  if (target === "instagram") return copy.instagram;
  return copy.facebook;
}

function formatSubmissionTime(submission: PagePostSubmission, language: InterfaceLanguage) {
  const value = submission.scheduledFor || submission.createdAt;
  return formatDate(value, language);
}

function formatDate(value: string, language: InterfaceLanguage) {
  return new Date(value).toLocaleString(language === "vi" ? "vi-VN" : "en-US");
}
