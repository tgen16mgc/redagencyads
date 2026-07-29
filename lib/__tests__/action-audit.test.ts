import { describe, expect, it, vi } from "vitest";
import { JsonActionAuditStore, MemoryActionAuditStore, listActions, processDeferredBudgetActions, recordAction } from "@/lib/action-audit";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("durable action audit and learning resume", () => {
  it("persists action entries atomically", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "action-audit-"));
    try {
      const filePath = path.join(directory, "audit.json");
      const store = new JsonActionAuditStore(filePath);
      const entry = await recordAction({ action: "budget_change", target: "campaign-1", status: "planned", details: { budget: 110 } }, store);
      expect((await listActions(new JsonActionAuditStore(filePath)))[0]).toMatchObject({ id: entry.id, target: "campaign-1", status: "planned" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps learning actions deferred and applies them after learning exits", async () => {
    const store = new MemoryActionAuditStore();
    await recordAction({ action: "budget_change", target: "campaign-1", status: "deferred", resumeWhen: "learning_exit", details: { platform: "meta", budget: 125 } }, store);
    const applyBudget = vi.fn();
    expect((await processDeferredBudgetActions({ store, getLearningStatus: async () => "LEARNING", applyBudget })).deferredRemaining).toBe(1);
    expect(applyBudget).not.toHaveBeenCalled();
    expect((await processDeferredBudgetActions({ store, getLearningStatus: async () => undefined, applyBudget })).deferredRemaining).toBe(1);
    expect(applyBudget).not.toHaveBeenCalled();
    const result = await processDeferredBudgetActions({ store, getLearningStatus: async () => "NOT_LEARNING", applyBudget });
    expect(result.processed[0]).toMatchObject({ status: "applied", target: "campaign-1" });
    expect(applyBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "meta",
        targetId: "campaign-1",
        budget: 125,
      }),
    );
    expect((await listActions(store))[0].status).toBe("applied");
  });

  it("resumes pacing-originated budget changes", async () => {
    const store = new MemoryActionAuditStore();
    const entry = await recordAction({ action: "pacing_budget_change", target: "campaign-2", status: "deferred", resumeWhen: "learning_exit", details: { platform: "meta", cadence: "monthly", curve: "linear", recommendedDailyBudget: 80 } }, store);
    const applyBudget = vi.fn();
    const result = await processDeferredBudgetActions({ store, getLearningStatus: async () => "ACTIVE", applyBudget });
    expect(result.processed[0]).toMatchObject({ id: entry.id, status: "applied" });
    expect(applyBudget).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: "campaign-2", budget: 80 }),
    );
  });

  it("resumes Google Ads budget changes after bidding strategy learning exits", async () => {
    const store = new MemoryActionAuditStore();
    await recordAction({
      action: "budget_change",
      target: "campaignBudgets/456",
      status: "deferred",
      resumeWhen: "learning_exit",
      details: {
        platform: "google_ads",
        campaignId: "campaigns/123",
        budget: 140,
      },
    }, store);
    const applyBudget = vi.fn();
    const getLearningStatus = vi.fn().mockResolvedValueOnce("LEARNING_BUDGET_CHANGE").mockResolvedValueOnce("ENABLED");

    expect((await processDeferredBudgetActions({ store, getLearningStatus, applyBudget })).deferredRemaining).toBe(1);
    expect(applyBudget).not.toHaveBeenCalled();
    const result = await processDeferredBudgetActions({ store, getLearningStatus, applyBudget });

    expect(result.deferredRemaining).toBe(0);
    expect(applyBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "google_ads",
        campaignId: "campaigns/123",
        targetId: "campaignBudgets/456",
        budget: 140,
      }),
    );
  });

  it("keeps transient resume failures deferred for the next cron attempt", async () => {
    const store = new MemoryActionAuditStore();
    await recordAction({ action: "budget_change", target: "campaign-1", status: "deferred", resumeWhen: "learning_exit", details: { platform: "meta", budget: 125 } }, store);

    const result = await processDeferredBudgetActions({
      store,
      getLearningStatus: async () => "ACTIVE",
      applyBudget: async () => { throw new Error("Temporary provider outage"); },
    });
    const entry = (await listActions(store))[0];

    expect(result.deferredRemaining).toBe(1);
    expect(entry).toMatchObject({
      status: "deferred",
      error: "Temporary provider outage",
      details: { resumeAttempts: 1 },
    });
  });
});
