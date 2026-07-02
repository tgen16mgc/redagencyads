import type { MediaAttachment, PagePostMode, PublishTarget } from "@/lib/types";

export type PagePostDraft = {
  pageId: string;
  message: string;
  link: string;
  mode: PagePostMode;
  scheduledFor: string;
  target?: PublishTarget;
  media?: MediaAttachment | null;
  mediaItems?: MediaAttachment[];
};

export type PagePostValidationMessages = {
  pageRequired: string;
  contentRequired: string;
  scheduleRequired: string;
  scheduleTooSoon: string;
  instagramMediaRequired: string;
  instagramScheduleUnsupported: string;
  multipleMediaInstagramUnsupported: string;
  multipleVideoUnsupported: string;
};

const EN_MESSAGES: PagePostValidationMessages = {
  pageRequired: "Choose a Page before publishing.",
  contentRequired: "Add a message, link, or media before publishing.",
  scheduleRequired: "Choose a schedule time.",
  scheduleTooSoon: "Schedule time must be at least 10 minutes in the future.",
  instagramMediaRequired: "Instagram posts require an image, video, or GIF attachment.",
  instagramScheduleUnsupported: "Instagram scheduling is not available here yet; use Facebook or publish now.",
  multipleMediaInstagramUnsupported: "Multiple media attachments are only supported for Facebook posts right now.",
  multipleVideoUnsupported: "Multiple media Facebook posts can only use images or GIFs.",
};

export function validatePagePostDraft(
  draft: PagePostDraft,
  now = Date.now(),
  messages: PagePostValidationMessages = EN_MESSAGES,
) {
  const target = draft.target || "facebook";
  const mediaItems = normalizeMediaItems(draft.mediaItems, draft.media);
  const hasMedia = mediaItems.length > 0;

  if (!draft.pageId) return messages.pageRequired;
  if (!draft.message.trim() && !draft.link.trim() && !hasMedia) return messages.contentRequired;
  if ((target === "instagram" || target === "both") && !hasMedia) return messages.instagramMediaRequired;
  if ((target === "instagram" || target === "both") && mediaItems.length > 1) return messages.multipleMediaInstagramUnsupported;
  if (target === "facebook" && mediaItems.length > 1 && mediaItems.some((item) => item.type === "video")) return messages.multipleVideoUnsupported;
  if ((target === "instagram" || target === "both") && draft.mode === "scheduled") return messages.instagramScheduleUnsupported;
  if (draft.mode !== "scheduled") return null;

  const scheduledAt = draft.scheduledFor ? new Date(draft.scheduledFor).getTime() : NaN;
  if (!Number.isFinite(scheduledAt)) return messages.scheduleRequired;
  if (scheduledAt < now + 10 * 60 * 1000) return messages.scheduleTooSoon;
  return null;
}

function normalizeMediaItems(mediaItems?: MediaAttachment[], media?: MediaAttachment | null) {
  return (mediaItems?.length ? mediaItems : media ? [media] : []).filter((item) => item.url || item.file);
}

export type SchedulePreset = "in_1_hour" | "tomorrow_morning" | "tomorrow_afternoon" | "next_weekday_morning" | "next_weekday_afternoon";

export function getSchedulePresetDateTimeLocal(preset: SchedulePreset, from = new Date()) {
  const date = new Date(from);

  if (preset === "in_1_hour") {
    date.setHours(date.getHours() + 1, date.getMinutes(), 0, 0);
    return formatDateTimeLocal(date);
  }

  date.setDate(date.getDate() + 1);
  if (preset === "next_weekday_morning" || preset === "next_weekday_afternoon") {
    while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  }

  date.setHours(preset.endsWith("morning") ? 9 : 14, 0, 0, 0);
  return formatDateTimeLocal(date);
}

function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
