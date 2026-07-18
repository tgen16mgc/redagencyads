import type { PagePostSubmission } from "@/lib/types";

export type FacebookGroupDestination = {
  name: string;
  url: string;
};

const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"]);

export function normalizeFacebookGroupUrl(value: string) {
  const input = value.trim();
  if (!input) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!FACEBOOK_HOSTS.has(url.hostname.toLowerCase())) return null;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0]?.toLowerCase() !== "groups" || !segments[1]) return null;

    return `https://www.facebook.com/groups/${segments[1]}/`;
  } catch {
    return null;
  }
}

export function facebookGroupFallbackName(url: string) {
  const normalized = normalizeFacebookGroupUrl(url);
  const identifier = normalized?.split("/").filter(Boolean).at(-1) || "Facebook group";
  try {
    return decodeURIComponent(identifier).replace(/[-_]+/g, " ");
  } catch {
    return identifier.replace(/[-_]+/g, " ");
  }
}

export function sanitizeFacebookGroupDestinations(value: unknown): FacebookGroupDestination[] {
  if (!Array.isArray(value)) return [];

  const destinations = new Map<string, FacebookGroupDestination>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as { name?: unknown; url?: unknown };
    if (typeof raw.url !== "string") continue;
    const url = normalizeFacebookGroupUrl(raw.url);
    if (!url) continue;
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 120) : facebookGroupFallbackName(url);
    destinations.set(url, { name, url });
  }
  return Array.from(destinations.values());
}

export function getFacebookSubmissionUrl(submission: PagePostSubmission | null | undefined) {
  if (!submission) return undefined;
  const facebookResult = submission.results?.find((result) => result.target === "facebook" && result.metaPostId);
  const postId = facebookResult?.metaPostId || (submission.target === "facebook" ? submission.metaPostId : undefined);
  if (!postId) return undefined;

  const pagePrefix = `${submission.pageId}_`;
  if (postId.startsWith(pagePrefix) && postId.length > pagePrefix.length) {
    return `https://www.facebook.com/${submission.pageId}/posts/${postId.slice(pagePrefix.length)}`;
  }
  return `https://www.facebook.com/${postId}`;
}

export function buildFacebookGroupHandoffText(input: {
  message?: string;
  link?: string;
  facebookPostUrl?: string;
}) {
  const message = input.message?.trim() || "";
  const shareUrl = input.facebookPostUrl?.trim() || input.link?.trim() || "";
  if (!shareUrl || message.includes(shareUrl)) return message;
  return [message, shareUrl].filter(Boolean).join("\n\n");
}
