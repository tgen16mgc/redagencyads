import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaGraphRequestError, graphList, graphRequest } from "../meta-graph";

function graphResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("graphRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("builds Graph URLs with version, params, and access token, skipping empty values", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(graphResponse({ id: "me_1" }));
    vi.stubGlobal("fetch", fetchSpy);

    await graphRequest({
      path: "/me",
      params: { fields: "id,name", limit: 25, filtering: undefined, breakdowns: "" },
      token: "user-token",
    });

    const url = fetchSpy.mock.calls[0][0] as URL;
    expect(url.origin).toBe("https://graph.facebook.com");
    expect(url.pathname).toBe("/v22.0/me");
    expect(url.searchParams.get("fields")).toBe("id,name");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.has("filtering")).toBe(false);
    expect(url.searchParams.has("breakdowns")).toBe(false);
    expect(url.searchParams.get("access_token")).toBe("user-token");
    expect(fetchSpy.mock.calls[0][1]).toEqual({ cache: "no-store" });
  });

  it("resolves the Graph version from META_GRAPH_VERSION", async () => {
    vi.stubEnv("META_GRAPH_VERSION", "v23.0");
    const fetchSpy = vi.fn().mockResolvedValue(graphResponse({}));
    vi.stubGlobal("fetch", fetchSpy);

    await graphRequest({ path: "/me" });

    expect((fetchSpy.mock.calls[0][0] as URL).pathname).toBe("/v23.0/me");
  });

  it("posts bodies to alternate Graph hosts", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(graphResponse({ id: "video_1" }));
    vi.stubGlobal("fetch", fetchSpy);
    const body = new URLSearchParams({ access_token: "page-token", upload_phase: "start" });

    await graphRequest({ path: "/page_1/videos", method: "POST", body, host: "graph-video.facebook.com" });

    const url = fetchSpy.mock.calls[0][0] as URL;
    expect(url.origin).toBe("https://graph-video.facebook.com");
    expect(url.pathname).toBe("/v22.0/page_1/videos");
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: "POST", body });
  });

  it("throws a MetaGraphRequestError carrying the Graph error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(graphResponse({ error: { code: 200, message: "Permission denied", type: "OAuthException" } }, 400)),
    );

    const failure = (await graphRequest({ path: "/me", token: "bad-token" }).catch((error) => error)) as MetaGraphRequestError;

    expect(failure).toBeInstanceOf(MetaGraphRequestError);
    expect(failure.message).toBe("Permission denied");
    expect(failure.status).toBe(400);
    expect(failure.graphError).toEqual({ code: 200, message: "Permission denied", type: "OAuthException" });
  });

  it("falls back to a status message when the error envelope is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(graphResponse({}, 500)));

    await expect(graphRequest({ path: "/me" })).rejects.toThrow("Meta Graph request failed: 500");
  });
});

describe("graphList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows paging.next until the pages are exhausted", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        graphResponse({ data: [{ id: "row_1" }], paging: { next: "https://graph.facebook.com/v22.0/me/accounts?after=cursor" } }),
      )
      .mockResolvedValueOnce(graphResponse({ data: [{ id: "row_2" }] }));
    vi.stubGlobal("fetch", fetchSpy);

    const rows = await graphList<{ id: string }>({ path: "/me/accounts", params: { fields: "id" }, token: "user-token" });

    expect(rows).toEqual([{ id: "row_1" }, { id: "row_2" }]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][0])).toContain("after=cursor");
    expect(fetchSpy.mock.calls[1][1]).toEqual({ cache: "no-store" });
  });

  it("stops paginating once max rows are collected", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        graphResponse({ data: [{ id: "row_1" }, { id: "row_2" }], paging: { next: "https://graph.facebook.com/next" } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const rows = await graphList({ path: "/me/accounts", max: 2 });

    expect(rows).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("surfaces the Graph error envelope from a pagination page", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(graphResponse({ data: [{ id: "row_1" }], paging: { next: "https://graph.facebook.com/next" } }))
      .mockResolvedValueOnce(graphResponse({ error: { message: "Session expired" } }, 401));
    vi.stubGlobal("fetch", fetchSpy);

    const failure = (await graphList({ path: "/me/accounts" }).catch((error) => error)) as MetaGraphRequestError;

    expect(failure).toBeInstanceOf(MetaGraphRequestError);
    expect(failure.message).toBe("Session expired");
    expect(failure.status).toBe(401);
  });
});
