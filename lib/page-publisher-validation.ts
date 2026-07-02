import type { PagePostMode } from "@/lib/types";

export type PagePostDraft = {
  pageId: string;
  message: string;
  link: string;
  mode: PagePostMode;
  scheduledFor: string;
};

export type PagePostValidationMessages = {
  pageRequired: string;
  contentRequired: string;
  scheduleRequired: string;
  scheduleTooSoon: string;
};

const EN_MESSAGES: PagePostValidationMessages = {
  pageRequired: "Choose a Page before publishing.",
  contentRequired: "Add a message or link before publishing.",
  scheduleRequired: "Choose a schedule time.",
  scheduleTooSoon: "Schedule time must be at least 10 minutes in the future.",
};

export function validatePagePostDraft(
  draft: PagePostDraft,
  now = Date.now(),
  messages: PagePostValidationMessages = EN_MESSAGES,
) {
  if (!draft.pageId) return messages.pageRequired;
  if (!draft.message.trim() && !draft.link.trim()) return messages.contentRequired;
  if (draft.mode !== "scheduled") return null;

  const scheduledAt = draft.scheduledFor ? new Date(draft.scheduledFor).getTime() : NaN;
  if (!Number.isFinite(scheduledAt)) return messages.scheduleRequired;
  if (scheduledAt < now + 10 * 60 * 1000) return messages.scheduleTooSoon;
  return null;
}
