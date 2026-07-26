export type MetaGraphErrorBody = {
  code?: number;
  message?: string;
  type?: string;
};

export class MetaGraphRequestError extends Error {
  status: number;
  graphError?: MetaGraphErrorBody;

  constructor(status: number, graphError?: MetaGraphErrorBody) {
    super(graphError?.message || `Meta Graph request failed: ${status}`);
    this.status = status;
    this.graphError = graphError;
  }
}

export type GraphRequestArgs = {
  path: string;
  params?: Record<string, string | number | undefined>;
  token?: string;
  method?: "GET" | "POST";
  body?: URLSearchParams | FormData;
  host?: string;
};

const graphVersion = () => process.env.META_GRAPH_VERSION || "v22.0";

function graphUrl(args: GraphRequestArgs) {
  const url = new URL(`https://${args.host || "graph.facebook.com"}/${graphVersion()}${args.path}`);
  for (const [key, value] of Object.entries(args.params || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  if (args.token) url.searchParams.set("access_token", args.token);
  return url;
}

async function graphFetch<T>(url: URL | string, init?: { method: "POST"; body?: URLSearchParams | FormData }): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const json = (await response.json()) as T & { error?: MetaGraphErrorBody };
  if (!response.ok) throw new MetaGraphRequestError(response.status, json?.error);
  return json;
}

export async function graphRequest<T>(args: GraphRequestArgs): Promise<T> {
  return graphFetch<T>(graphUrl(args), args.method === "POST" ? { method: "POST", body: args.body } : undefined);
}

export async function graphList<T>(args: GraphRequestArgs & { max?: number }): Promise<T[]> {
  const max = args.max ?? 500;
  const first = await graphRequest<{ data?: T[]; paging?: { next?: string } }>(args);
  const rows = [...(first.data || [])];
  let next = first.paging?.next;
  while (next && rows.length < max) {
    const page = await graphFetch<{ data?: T[]; paging?: { next?: string } }>(next);
    rows.push(...(page.data || []));
    next = page.paging?.next;
  }
  return rows;
}
