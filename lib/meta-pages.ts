import { FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE, type MediaAttachment, type MetaPage, type PagePostMode, type PagePostSubmission, type PublishTarget } from "@/lib/types";

const graphVersion = () => process.env.META_GRAPH_VERSION || "v22.0";
export const pagePublishingPermissions = ["pages_read_engagement", "pages_manage_posts"];
export const pageSetupPermissions = ["pages_show_list", ...pagePublishingPermissions];
const instagramPostPermissions = ["instagram_basic", "instagram_content_publish"];

type MetaPageWithToken = MetaPage & {
  access_token?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
};

type PagesResponse = {
  data?: MetaPageWithToken[];
  paging?: { next?: string };
};

type PermissionsResponse = {
  data?: Array<{ permission?: string; status?: string }>;
};

type MetaGraphError = {
  code?: number;
  message?: string;
  type?: string;
};

type GraphErrorBody = {
  error?: MetaGraphError;
};

type PageContext = {
  permissions: Set<string>;
  pages: Array<MetaPageWithToken & Required<Pick<MetaPageWithToken, "access_token">>>;
};

function graphUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function graphVideoUrl(path: string) {
  return new URL(`https://graph-video.facebook.com/${graphVersion()}${path}`);
}

function mediaForClient(media?: MediaAttachment) {
  if (!media) return undefined;
  return { type: media.type, url: media.url, name: media.name };
}

function normalizeMediaItems(mediaItems?: MediaAttachment[], media?: MediaAttachment) {
  return (mediaItems?.length ? mediaItems : media ? [media] : []).filter((item) => item.url || item.file);
}

function mediaItemsForClient(mediaItems: MediaAttachment[]) {
  return mediaItems.map((item) => ({ type: item.type, url: item.url, name: item.name }));
}

function appendSchedule(body: URLSearchParams | FormData, mode: PagePostMode, scheduledAt?: number) {
  if (mode === "scheduled" && scheduledAt) {
    body.set("published", "false");
    body.set("scheduled_publish_time", String(Math.floor(scheduledAt / 1000)));
  }
}

function getGrantedPermissions(json: PermissionsResponse) {
  return new Set((json.data || []).filter((item) => item.status === "granted" && item.permission).map((item) => item.permission as string));
}

function missingPermissions(permissions: Set<string>, required: string[]) {
  return required.filter((permission) => !permissions.has(permission));
}

function normalizeGraphError(error: MetaGraphError | undefined, context: "facebook" | "instagram") {
  const message = error?.message || "Meta Graph request failed.";
  const lower = message.toLowerCase();
  if (
    context === "facebook" &&
    (error?.code === 200 || lower.includes("pages_manage_posts") || lower.includes("pages_read_engagement") || lower.includes("pages_show_list") || lower.includes("permission"))
  ) {
    return FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE;
  }
  if (lower.includes("instagram_basic") || lower.includes("instagram_content_publish") || lower.includes("permission")) {
    return "Meta rejected the Instagram post. Confirm this app has instagram_basic and instagram_content_publish approved and that the selected Page is linked to an Instagram business account.";
  }
  if (lower.includes("expired") || lower.includes("invalid oauth") || lower.includes("access token")) {
    return "Meta token is invalid or expired. Reconnect with a fresh token and try again.";
  }
  if (context === "instagram") return `Meta rejected the Instagram post: ${message}`;
  return `Meta rejected the Facebook Page post: ${message}`;
}

async function graphJson<T>(response: Response, context: "facebook" | "instagram" = "facebook"): Promise<T> {
  const json = (await response.json()) as T & GraphErrorBody;
  if (!response.ok) {
    throw new Error(normalizeGraphError(json?.error, context));
  }
  return json as T;
}

async function getPermissions(token: string) {
  const response = await fetch(graphUrl("/me/permissions", { access_token: token }), { cache: "no-store" });
  const json = await graphJson<PermissionsResponse>(response);
  return getGrantedPermissions(json);
}

function decoratePage(page: MetaPageWithToken, permissions: Set<string>): MetaPageWithToken {
  const pageMissing = missingPermissions(permissions, pageSetupPermissions);
  const instagramMissing = missingPermissions(permissions, instagramPostPermissions);
  const instagramBusinessAccount = page.instagram_business_account;
  const pageTaskIssues = page.tasks?.includes("CREATE_CONTENT") ? [] : ["Your Page role is missing the CREATE_CONTENT task."];
  const instagramIssues = instagramBusinessAccount ? [] : ["This Page is not linked to an Instagram business account."];

  return {
    ...page,
    instagramBusinessAccount,
    capabilities: {
      facebook: {
        canPublish: pageMissing.length === 0 && pageTaskIssues.length === 0,
        canSchedule: pageMissing.length === 0 && pageTaskIssues.length === 0,
        missingPermissions: pageMissing,
        issues: pageTaskIssues,
      },
      instagram: {
        canPublish: Boolean(instagramBusinessAccount) && instagramMissing.length === 0,
        canSchedule: false,
        missingPermissions: instagramMissing,
        issues: instagramIssues,
        accountId: instagramBusinessAccount?.id,
        username: instagramBusinessAccount?.username,
      },
    },
  };
}

async function getEligiblePagesContext(token: string): Promise<PageContext> {
  const permissions = await getPermissions(token);
  let nextUrl: URL | string | undefined = graphUrl("/me/accounts", {
    fields: "id,name,category,tasks,access_token,instagram_business_account{id,username}",
    access_token: token,
  });
  const pages: MetaPageWithToken[] = [];

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, { cache: "no-store" });
    const json = await graphJson<PagesResponse>(response);
    pages.push(...(json.data || []));
    nextUrl = json.paging?.next;
  }

  return {
    permissions,
    pages: pages
      .filter((page): page is MetaPageWithToken & Required<Pick<MetaPageWithToken, "access_token">> =>
        Boolean(page.access_token && page.tasks?.includes("CREATE_CONTENT")),
      )
      .map((page) => decoratePage(page, permissions) as MetaPageWithToken & Required<Pick<MetaPageWithToken, "access_token">>),
  };
}

async function getFacebookPublishingPage(token: string, pageId: string) {
  const { permissions, pages } = await getEligiblePagesContext(token);
  const page = pages.find((item) => item.id === pageId);
  if (!page?.access_token) throw new Error("Selected Page not found for current token.");
  assertFacebookReady(page, permissions);
  return page;
}

export async function getPages(token: string): Promise<MetaPage[]> {
  const { pages } = await getEligiblePagesContext(token);
  return pages.map(({ access_token, instagram_business_account, ...page }) => page);
}

function validateSchedule(mode: PagePostMode, scheduledFor?: string) {
  const scheduledAt = scheduledFor ? new Date(scheduledFor).getTime() : undefined;
  if (mode === "scheduled") {
    if (!scheduledAt) throw new Error("Schedule time is required.");
    if (scheduledAt < Date.now() + 10 * 60 * 1000) {
      throw new Error("Schedule time must be at least 10 minutes in the future.");
    }
  }
  return scheduledAt;
}

function assertFacebookReady(page: MetaPageWithToken, permissions: Set<string>) {
  const missing = missingPermissions(permissions, pagePublishingPermissions);
  if (missing.length) throw new Error(FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE);
  if (!page.tasks?.includes("CREATE_CONTENT")) throw new Error(FACEBOOK_PAGE_PUBLISHING_SETUP_MESSAGE);
}

function assertInstagramReady(page: MetaPageWithToken, permissions: Set<string>, media?: MediaAttachment, mode?: PagePostMode) {
  if (!media?.url) throw new Error("Instagram posts require an image, video, or GIF attachment.");
  if (mode === "scheduled") throw new Error("Instagram scheduling is not available here yet; use Facebook or publish now.");
  const missing = missingPermissions(permissions, instagramPostPermissions);
  if (missing.length) throw new Error(`Reconnect Meta with ${missing[0]} to publish Instagram posts.`);
  if (!page.instagram_business_account?.id) {
    throw new Error("Selected Page is not linked to an Instagram business account.");
  }
}

async function uploadUnpublishedPhoto(
  page: MetaPageWithToken & Required<Pick<MetaPageWithToken, "access_token">>,
  media: MediaAttachment,
  scheduled: boolean,
) {
  let body: URLSearchParams | FormData = new URLSearchParams({ access_token: page.access_token, published: "false" });
  if (media.file) {
    body = new FormData();
    body.set("access_token", page.access_token);
    body.set("published", "false");
    body.set("source", media.file);
  } else if (media.url) {
    body.set("url", media.url);
  } else {
    throw new Error("Facebook image and GIF posts require a media URL or file.");
  }
  if (scheduled) body.set("temporary", "true");

  const response = await fetch(graphUrl(`/${page.id}/photos`, {}), { method: "POST", body });
  const json = await graphJson<{ id: string }>(response, "facebook");
  return json.id;
}

async function publishFacebook(input: {
  page: MetaPageWithToken & Required<Pick<MetaPageWithToken, "access_token">>;
  message?: string;
  link?: string;
  mediaItems: MediaAttachment[];
  mode: PagePostMode;
  scheduledAt?: number;
}) {
  if (input.mediaItems.length > 1) {
    if (input.mediaItems.some((item) => item.type === "video")) throw new Error("Multiple media Facebook posts can only use images or GIFs.");
    const photoIds = [];
    for (const media of input.mediaItems) {
      photoIds.push(await uploadUnpublishedPhoto(input.page, media, input.mode === "scheduled"));
    }
    const body = new URLSearchParams({ access_token: input.page.access_token });
    if (input.message) body.set("message", input.message);
    if (input.link) body.set("link", input.link);
    photoIds.forEach((id, index) => body.set(`attached_media[${index}]`, JSON.stringify({ media_fbid: id })));
    appendSchedule(body, input.mode, input.scheduledAt);

    const response = await fetch(graphUrl(`/${input.page.id}/feed`, {}), { method: "POST", body });
    const json = await graphJson<{ id: string }>(response, "facebook");
    return json.id;
  }

  const media = input.mediaItems[0];
  let path = `/${input.page.id}/feed`;
  let body: URLSearchParams | FormData = new URLSearchParams({ access_token: input.page.access_token });

  if (media?.type === "image" || media?.type === "gif") {
    path = `/${input.page.id}/photos`;
    if (media.file) {
      body = new FormData();
      body.set("access_token", input.page.access_token);
      body.set("source", media.file);
    } else if (media.url) {
      body.set("url", media.url);
    } else {
      throw new Error("Facebook image and GIF posts require a media URL or file.");
    }
    if (input.message) body.set("caption", input.message);
  } else if (media?.type === "video") {
    path = `/${input.page.id}/videos`;
    if (media.file) {
      body = new FormData();
      body.set("access_token", input.page.access_token);
      body.set("source", media.file);
    } else if (media.url) {
      body.set("file_url", media.url);
    } else {
      throw new Error("Facebook video posts require a media URL or file.");
    }
    if (input.message) body.set("description", input.message);
  } else {
    if (input.message) body.set("message", input.message);
    if (input.link) body.set("link", input.link);
  }

  appendSchedule(body, input.mode, input.scheduledAt);

  const response = await fetch(graphUrl(path, {}), { method: "POST", body });
  const json = await graphJson<{ id: string; post_id?: string }>(response, "facebook");
  return json.post_id || json.id;
}

async function publishInstagram(input: { token: string; page: MetaPageWithToken; message?: string; media: MediaAttachment }) {
  const accountId = input.page.instagram_business_account?.id;
  if (!accountId || !input.media.url) throw new Error("Selected Page is not linked to an Instagram business account.");

  const createBody = new URLSearchParams({ access_token: input.token });
  if (input.message) createBody.set("caption", input.message);
  if (input.media.type === "video") createBody.set("video_url", input.media.url);
  else createBody.set("image_url", input.media.url);

  const createResponse = await fetch(graphUrl(`/${accountId}/media`, {}), { method: "POST", body: createBody });
  const container = await graphJson<{ id: string }>(createResponse, "instagram");

  const publishBody = new URLSearchParams({ access_token: input.token, creation_id: container.id });
  const publishResponse = await fetch(graphUrl(`/${accountId}/media_publish`, {}), { method: "POST", body: publishBody });
  const published = await graphJson<{ id: string }>(publishResponse, "instagram");
  return published.id;
}

export async function publishPageFeedPost(input: {
  token: string;
  pageId: string;
  message?: string;
  link?: string;
  mode: PagePostMode;
  scheduledFor?: string;
  target?: PublishTarget;
  media?: MediaAttachment;
  mediaItems?: MediaAttachment[];
}): Promise<PagePostSubmission> {
  const mediaItems = normalizeMediaItems(input.mediaItems, input.media);
  if (!input.message && !input.link && mediaItems.length === 0) {
    throw new Error("Message, link, or media is required.");
  }

  const target = input.target || "facebook";
  if ((target === "instagram" || target === "both") && mediaItems.length > 1) {
    throw new Error("Multiple media attachments are only supported for Facebook posts right now.");
  }
  if ((target === "instagram" || target === "both") && mediaItems.some((item) => item.file)) {
    throw new Error("Instagram publishing requires a public hosted media URL. Local file uploads are supported only for Facebook.");
  }
  if (target === "facebook" && mediaItems.length > 1 && mediaItems.some((item) => item.type === "video")) {
    throw new Error("Multiple media Facebook posts can only use images or GIFs.");
  }
  if ((target === "instagram" || target === "both") && input.mode === "scheduled") {
    throw new Error("Instagram scheduling is not available here yet; use Facebook or publish now.");
  }
  const scheduledAt = validateSchedule(input.mode, input.scheduledFor);
  const { permissions, pages } = await getEligiblePagesContext(input.token);
  const page = pages.find((item) => item.id === input.pageId);
  if (!page?.access_token) throw new Error("Selected Page not found for current token.");

  const results: NonNullable<PagePostSubmission["results"]> = [];

  if (target === "facebook" || target === "both") {
    assertFacebookReady(page, permissions);
    const metaPostId = await publishFacebook({
      page,
      message: input.message,
      link: input.link,
      mediaItems,
      mode: input.mode,
      scheduledAt,
    });
    results.push({ target: "facebook", metaPostId, status: input.mode === "scheduled" ? "scheduled" : "submitted" });
  }

  if (target === "instagram" || target === "both") {
    const media = mediaItems[0];
    assertInstagramReady(page, permissions, media, input.mode);
    const metaPostId = await publishInstagram({ token: input.token, page, message: input.message, media: media as MediaAttachment });
    results.push({ target: "instagram", metaPostId, status: "submitted" });
  }

  const primaryResult = results[0];
  if (!primaryResult?.metaPostId) throw new Error("Meta did not return a post ID.");

  return {
    pageId: page.id,
    pageName: page.name,
    metaPostId: primaryResult.metaPostId,
    message: input.message,
    link: input.link,
    mode: input.mode,
    target,
    media: mediaForClient(mediaItems[0]),
    mediaItems: mediaItemsForClient(mediaItems),
    status: input.mode === "scheduled" ? "scheduled" : "submitted",
    results,
    scheduledFor: input.scheduledFor,
    createdAt: new Date().toISOString(),
  };
}

type FacebookVideoUploadContext = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  uploadSessionId: string;
  videoId: string;
};

export async function startFacebookVideoUpload(input: { token: string; pageId: string; fileSize: number }) {
  const page = await getFacebookPublishingPage(input.token, input.pageId);
  const body = new URLSearchParams({
    access_token: page.access_token,
    upload_phase: "start",
    file_size: String(input.fileSize),
  });
  const response = await fetch(graphVideoUrl(`/${page.id}/videos`), { method: "POST", body });
  const upload = await graphJson<{
    upload_session_id: string;
    video_id: string;
    start_offset: string;
    end_offset: string;
  }>(response, "facebook");

  return {
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    uploadSessionId: upload.upload_session_id,
    videoId: upload.video_id,
    startOffset: Number(upload.start_offset),
    endOffset: Number(upload.end_offset),
  };
}

export async function transferFacebookVideoUpload(input: {
  pageId: string;
  pageAccessToken: string;
  uploadSessionId: string;
  startOffset: number;
  chunk: File;
}) {
  const body = new FormData();
  body.set("access_token", input.pageAccessToken);
  body.set("upload_phase", "transfer");
  body.set("upload_session_id", input.uploadSessionId);
  body.set("start_offset", String(input.startOffset));
  body.set("video_file_chunk", input.chunk, input.chunk.name || "video.mp4");

  const response = await fetch(graphVideoUrl(`/${input.pageId}/videos`), { method: "POST", body });
  const upload = await graphJson<{ start_offset: string; end_offset: string }>(response, "facebook");
  return { startOffset: Number(upload.start_offset), endOffset: Number(upload.end_offset) };
}

export async function finishFacebookVideoUpload(input: FacebookVideoUploadContext & {
  message?: string;
  link?: string;
  mode: PagePostMode;
  scheduledFor?: string;
  fileName: string;
}): Promise<PagePostSubmission> {
  const scheduledAt = validateSchedule(input.mode, input.scheduledFor);
  const body = new URLSearchParams({
    access_token: input.pageAccessToken,
    upload_phase: "finish",
    upload_session_id: input.uploadSessionId,
    published: "true",
  });
  if (input.message) body.set("description", input.message);
  appendSchedule(body, input.mode, scheduledAt);

  const response = await fetch(graphVideoUrl(`/${input.pageId}/videos`), { method: "POST", body });
  const finished = await graphJson<{ success?: boolean }>(response, "facebook");
  if (finished.success === false) throw new Error("Meta could not finish the Facebook video upload.");

  return {
    pageId: input.pageId,
    pageName: input.pageName,
    metaPostId: input.videoId,
    message: input.message,
    link: input.link,
    mode: input.mode,
    target: "facebook",
    media: { type: "video", name: input.fileName },
    mediaItems: [{ type: "video", name: input.fileName }],
    status: input.mode === "scheduled" ? "scheduled" : "submitted",
    results: [{ target: "facebook", metaPostId: input.videoId, status: input.mode === "scheduled" ? "scheduled" : "submitted" }],
    scheduledFor: input.scheduledFor,
    createdAt: new Date().toISOString(),
  };
}
