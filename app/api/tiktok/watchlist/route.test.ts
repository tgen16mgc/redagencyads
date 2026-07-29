import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GET, PUT } from "./route";

let directory = "";

describe("TikTok watchlist route", () => {
  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "watchlist-route-"));
    process.env.TIKTOK_WATCHLIST_PATH = path.join(directory, "watchlist.json");
  });

  afterEach(async () => {
    delete process.env.TIKTOK_WATCHLIST_PATH;
    await rm(directory, { recursive: true, force: true });
  });

  it("normalizes, deduplicates, and persists advertiser handles", async () => {
    const response = await PUT(new Request("http://localhost/api/tiktok/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ handles: ["@Brand", "brand", "Second"] }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).watchlist.handles).toEqual(["brand", "second"]);
    expect((await (await GET()).json()).watchlist.handles).toEqual(["brand", "second"]);
  });

  it("rejects more than 50 handles", async () => {
    const response = await PUT(new Request("http://localhost/api/tiktok/watchlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ handles: Array.from({ length: 51 }, (_, index) => `brand-${index}`) }) }));
    expect(response.status).toBe(400);
  });
});
