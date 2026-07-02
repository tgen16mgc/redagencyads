import type { MetaPage, PagePostMode, PagePostSubmission } from "@/lib/types";

const graphVersion = () => process.env.META_GRAPH_VERSION || "v22.0";

type MetaPageWithToken = MetaPage & { access_token?: string };

type PagesResponse = {
  data?: MetaPageWithToken[];
  paging?: { next?: string };
};

function graphUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function graphJson<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || `Meta Graph request failed: ${response.status}`);
  }
  return json as T;
}

async function getEligiblePagesWithTokens(token: string) {
  let nextUrl: URL | string | undefined = graphUrl("/me/accounts", {
    fields: "id,name,category,tasks,access_token",
    access_token: token,
  });
  const pages: MetaPageWithToken[] = [];

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, { cache: "no-store" });
    const json = await graphJson<PagesResponse>(response);
    pages.push(...(json.data || []));
    nextUrl = json.paging?.next;
  }

  return pages.filter((page) => page.tasks?.includes("CREATE_CONTENT"));
}

export async function getPages(token: string): Promise<MetaPage[]> {
  const pages = await getEligiblePagesWithTokens(token);
  return pages.map(({ access_token, ...page }) => page);
}

export async function publishPageFeedPost(input: {
  token: string;
  pageId: string;
  message?: string;
  link?: string;
  mode: PagePostMode;
  scheduledFor?: string;
}): Promise<PagePostSubmission> {
  if (!input.message && !input.link) {
    throw new Error("Message or link is required.");
  }

  const scheduledAt = input.scheduledFor ? new Date(input.scheduledFor).getTime() : undefined;
  if (input.mode === "scheduled") {
    if (!scheduledAt) throw new Error("Schedule time is required.");
    if (scheduledAt < Date.now() + 10 * 60 * 1000) {
      throw new Error("Schedule time must be at least 10 minutes in the future.");
    }
  }

  const page = (await getEligiblePagesWithTokens(input.token)).find((item) => item.id === input.pageId);
  if (!page?.access_token) throw new Error("Selected Page not found for current token.");

  const body = new URLSearchParams({ access_token: page.access_token });
  if (input.message) body.set("message", input.message);
  if (input.link) body.set("link", input.link);
  if (input.mode === "scheduled" && scheduledAt) {
    body.set("published", "false");
    body.set("scheduled_publish_time", String(Math.floor(scheduledAt / 1000)));
  }

  const response = await fetch(graphUrl(`/${page.id}/feed`, {}), { method: "POST", body });
  const json = await graphJson<{ id: string }>(response);

  return {
    pageId: page.id,
    pageName: page.name,
    metaPostId: json.id,
    message: input.message,
    link: input.link,
    mode: input.mode,
    status: input.mode === "scheduled" ? "scheduled" : "submitted",
    scheduledFor: input.scheduledFor,
    createdAt: new Date().toISOString(),
  };
}
