"use client";

import * as React from "react";
import { CalendarClockIcon, CheckCircle2Icon, FileTextIcon, RefreshCcwIcon, SendIcon } from "lucide-react";
import type { InterfaceLanguage, MetaPage, PagePostMode, PagePostSubmission } from "@/lib/types";
import { validatePagePostDraft, type PagePostValidationMessages } from "@/lib/page-publisher-validation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Copy = {
  title: string;
  description: string;
  pageLabel: string;
  pagePlaceholder: string;
  pageHelp: string;
  refreshPages: string;
  messageLabel: string;
  messagePlaceholder: string;
  linkLabel: string;
  linkPlaceholder: string;
  modeLabel: string;
  publishNow: string;
  scheduled: string;
  scheduleLabel: string;
  scheduleHelp: string;
  submit: string;
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
  postColumn: string;
  statusColumn: string;
  timeColumn: string;
  safetyTitle: string;
  safetyDescription: string;
  textPost: string;
  linkPost: string;
  pagesLoadFailed: string;
  publishFailed: string;
  validation: PagePostValidationMessages;
};

const COPY: Record<InterfaceLanguage, Copy> = {
  en: {
    title: "Page publisher",
    description: "Publish or schedule text/link posts for connected Facebook Pages using Meta-native scheduling.",
    pageLabel: "Facebook Page",
    pagePlaceholder: "Choose a Page",
    pageHelp: "Only Pages where your token has content creation permissions are shown.",
    refreshPages: "Refresh Pages",
    messageLabel: "Post message",
    messagePlaceholder: "Write the Page post copy...",
    linkLabel: "Optional link",
    linkPlaceholder: "https://example.com/landing-page",
    modeLabel: "Publishing mode",
    publishNow: "Publish now",
    scheduled: "Schedule",
    scheduleLabel: "Schedule time",
    scheduleHelp: "Meta requires scheduled posts to be at least 10 minutes in the future.",
    submit: "Submit Page post",
    submitting: "Submitting",
    loadingPages: "Loading Pages",
    noPagesTitle: "No content-ready Pages",
    noPagesDescription: "Reconnect with a Meta token that can create content on at least one Facebook Page.",
    successTitle: "Submitted to Meta",
    successDescription: "Meta post ID",
    recentTitle: "Recent submissions",
    recentDescription: "This list is kept in this browser session only.",
    recentEmptyTitle: "No Page posts submitted yet",
    recentEmptyDescription: "Published and scheduled submissions will appear here after Meta accepts them.",
    pageColumn: "Page",
    postColumn: "Post",
    statusColumn: "Status",
    timeColumn: "Time",
    safetyTitle: "Server-side publishing",
    safetyDescription: "Page permissions are checked server-side. Page tokens are not returned to this panel.",
    textPost: "Text",
    linkPost: "Link",
    pagesLoadFailed: "Unable to load Pages.",
    publishFailed: "Unable to submit Page post.",
    validation: {
      pageRequired: "Choose a Page before publishing.",
      contentRequired: "Add a message or link before publishing.",
      scheduleRequired: "Choose a schedule time.",
      scheduleTooSoon: "Schedule time must be at least 10 minutes in the future.",
    },
  },
  vi: {
    title: "Đăng bài Page",
    description: "Đăng ngay hoặc lên lịch bài text/link cho Facebook Page bằng lịch native của Meta.",
    pageLabel: "Facebook Page",
    pagePlaceholder: "Chọn Page",
    pageHelp: "Chỉ hiển thị Page mà token hiện tại có quyền tạo nội dung.",
    refreshPages: "Tải lại Page",
    messageLabel: "Nội dung bài đăng",
    messagePlaceholder: "Viết copy cho bài Page...",
    linkLabel: "Link tùy chọn",
    linkPlaceholder: "https://example.com/landing-page",
    modeLabel: "Chế độ đăng",
    publishNow: "Đăng ngay",
    scheduled: "Lên lịch",
    scheduleLabel: "Thời gian lên lịch",
    scheduleHelp: "Meta yêu cầu bài lên lịch phải cách hiện tại ít nhất 10 phút.",
    submit: "Gửi bài Page",
    submitting: "Đang gửi",
    loadingPages: "Đang tải Page",
    noPagesTitle: "Không có Page đủ quyền đăng",
    noPagesDescription: "Kết nối lại bằng Meta token có quyền tạo nội dung trên ít nhất một Facebook Page.",
    successTitle: "Đã gửi lên Meta",
    successDescription: "Meta post ID",
    recentTitle: "Lần gửi gần đây",
    recentDescription: "Danh sách này chỉ giữ trong phiên trình duyệt hiện tại.",
    recentEmptyTitle: "Chưa gửi bài Page nào",
    recentEmptyDescription: "Bài đăng ngay và bài lên lịch sẽ xuất hiện ở đây sau khi Meta chấp nhận.",
    pageColumn: "Page",
    postColumn: "Bài đăng",
    statusColumn: "Trạng thái",
    timeColumn: "Thời gian",
    safetyTitle: "Đăng qua server",
    safetyDescription: "Quyền Page được kiểm tra trên server. Token Page không được trả về panel này.",
    textPost: "Text",
    linkPost: "Link",
    pagesLoadFailed: "Không tải được Page.",
    publishFailed: "Không gửi được bài Page.",
    validation: {
      pageRequired: "Chọn Page trước khi đăng.",
      contentRequired: "Thêm nội dung hoặc link trước khi đăng.",
      scheduleRequired: "Chọn thời gian lên lịch.",
      scheduleTooSoon: "Thời gian lên lịch phải sau hiện tại ít nhất 10 phút.",
    },
  },
};

export function PagePublisherPanel({ language }: { language: InterfaceLanguage }) {
  const copy = COPY[language];
  const [pages, setPages] = React.useState<MetaPage[]>([]);
  const [pageId, setPageId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [link, setLink] = React.useState("");
  const [mode, setMode] = React.useState<PagePostMode>("publish_now");
  const [scheduledFor, setScheduledFor] = React.useState("");
  const [loadingPages, setLoadingPages] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState<PagePostSubmission | null>(null);
  const [submissions, setSubmissions] = React.useState<PagePostSubmission[]>([]);

  const loadPages = React.useCallback(async () => {
    setLoadingPages(true);
    setError("");
    try {
      const response = await fetch("/api/meta/pages");
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || copy.pagesLoadFailed);
      const nextPages = (json.pages || []) as MetaPage[];
      setPages(nextPages);
      setPageId((current) => current || nextPages[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.pagesLoadFailed);
    } finally {
      setLoadingPages(false);
    }
  }, [copy.pagesLoadFailed]);

  React.useEffect(() => {
    void loadPages();
  }, [loadPages]);

  async function submitPost(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess(null);

    const validation = validatePagePostDraft({ pageId, message, link, mode, scheduledFor }, Date.now(), copy.validation);
    if (validation) {
      setError(validation);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/meta/page-posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pageId,
          message: message.trim() || undefined,
          link: link.trim() || undefined,
          mode,
          scheduledFor: mode === "scheduled" ? new Date(scheduledFor).toISOString() : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || copy.publishFailed);
      const submission = json.submission as PagePostSubmission;
      setSuccess(submission);
      setSubmissions((current) => [submission, ...current].slice(0, 6));
      setMessage("");
      setLink("");
      if (mode === "scheduled") setScheduledFor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.publishFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <Card className="ra-fade-up overflow-hidden">
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
            <form onSubmit={submitPost} className="flex flex-col gap-4">
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field className="md:col-span-2">
                  <FieldLabel>{copy.pageLabel}</FieldLabel>
                  <Select
                    items={pages.map((page) => ({ label: page.name, value: page.id }))}
                    value={pageId}
                    onValueChange={(value) => {
                      if (value) setPageId(value);
                    }}
                  >
                    <SelectTrigger className="w-full" disabled={loadingPages}>
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

                <Field className="md:col-span-2">
                  <FieldLabel>{copy.messageLabel}</FieldLabel>
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={copy.messagePlaceholder}
                    rows={6}
                  />
                </Field>

                <Field className="md:col-span-2">
                  <FieldLabel>{copy.linkLabel}</FieldLabel>
                  <Input type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder={copy.linkPlaceholder} />
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
                    <FieldLabel>{copy.scheduleLabel}</FieldLabel>
                    <Input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
                    <FieldDescription>{copy.scheduleHelp}</FieldDescription>
                  </Field>
                ) : null}
              </FieldGroup>

              <Button type="submit" disabled={submitting || loadingPages || pages.length === 0} className="w-full sm:w-fit">
                {submitting ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
                {submitting ? copy.submitting : copy.submit}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="border-border bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClockIcon className="size-4 text-muted-foreground" />
              {copy.safetyTitle}
            </CardTitle>
            <CardDescription>{copy.safetyDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">{copy.publishNow}</Badge>
            <Badge variant="outline">{copy.scheduled}</Badge>
            <Badge variant="outline">{copy.textPost}</Badge>
            <Badge variant="outline">{copy.linkPost}</Badge>
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
                    <TableHead>{copy.statusColumn}</TableHead>
                    <TableHead>{copy.timeColumn}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={`${submission.metaPostId}-${submission.createdAt}`}>
                      <TableCell className="max-w-44 truncate font-medium">{submission.pageName}</TableCell>
                      <TableCell>
                        <Badge variant={submission.status === "scheduled" ? "secondary" : "success"}>{submission.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatSubmissionTime(submission, language)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty className="min-h-56 border">
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
    </section>
  );
}

function formatSubmissionTime(submission: PagePostSubmission, language: InterfaceLanguage) {
  const value = submission.scheduledFor || submission.createdAt;
  return new Date(value).toLocaleString(language === "vi" ? "vi-VN" : "en-US");
}
