import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonIncrementalityStore, saveIncrementalityStudy } from "@/lib/incrementality";

let directory = "";
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = ""; });

describe("incrementality persistence", () => {
  it("persists and replaces studies atomically", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "incrementality-"));
    const store = new JsonIncrementalityStore(path.join(directory, "studies.json"));
    await saveIncrementalityStudy({ id: "study-1", method: "geo_lift", startDate: "2026-07-01", endDate: "2026-07-07", lift: 0.1 }, store);
    await saveIncrementalityStudy({ id: "study-1", method: "geo_lift", startDate: "2026-07-01", endDate: "2026-07-07", lift: 0.2 }, store);
    expect(await store.read()).toEqual([expect.objectContaining({ id: "study-1", lift: 0.2 })]);
  });
});
