import { describe, expect, it } from "vitest";
import {
  SUFFICIENCY,
  hasReportSignal,
  hasRowDelivery,
  hasFunnelClickVolume,
  hasDatedHistory,
  hasBaselineHistory,
} from "../data-sufficiency";
import type { NormalizedRow } from "../types";

function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    id: "row",
    level: "ad",
    name: "Row",
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    linkClicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    messages: 0,
    replies: 0,
    leads: 0,
    purchases: 0,
    addToCart: 0,
    initiateCheckout: 0,
    costPerMessage: 0,
    costPerReply: 0,
    cpl: 0,
    cpaPurchase: 0,
    roas: 0,
    replyRate: 0,
    leadRate: 0,
    ...overrides,
  };
}

describe("data-sufficiency thresholds", () => {
  it("exposes canonical floors", () => {
    expect(SUFFICIENCY.minRowImpressions).toBe(1000);
    expect(SUFFICIENCY.minRowSpend).toBe(10);
    expect(SUFFICIENCY.minFunnelClicks).toBe(100);
    expect(SUFFICIENCY.minDatedRows).toBe(6);
    expect(SUFFICIENCY.minBaselineDays).toBe(14);
  });
});

describe("hasRowDelivery", () => {
  it("is true only when both impressions and spend clear the floor", () => {
    expect(hasRowDelivery(row({ impressions: 1000, spend: 10 }))).toBe(true);
    expect(hasRowDelivery(row({ impressions: 999, spend: 10 }))).toBe(false);
    expect(hasRowDelivery(row({ impressions: 1000, spend: 9 }))).toBe(false);
  });
});

describe("hasReportSignal", () => {
  it("blocks analysis when Meta returns an all-zero report", () => {
    expect(hasReportSignal(row({}))).toBe(false);
    expect(hasReportSignal(row({ impressions: 1 }))).toBe(true);
    expect(hasReportSignal(row({ messages: 1 }))).toBe(true);
  });
});

describe("hasFunnelClickVolume", () => {
  it("requires at least the click floor and a downstream event", () => {
    expect(hasFunnelClickVolume({ linkClicks: 100, addToCart: 1, initiateCheckout: 0, purchases: 0 })).toBe(true);
    expect(hasFunnelClickVolume({ linkClicks: 99, addToCart: 1, initiateCheckout: 0, purchases: 0 })).toBe(false);
    expect(hasFunnelClickVolume({ linkClicks: 100, addToCart: 0, initiateCheckout: 0, purchases: 0 })).toBe(false);
  });
});

describe("hasDatedHistory", () => {
  it("requires at least the dated-row floor", () => {
    expect(hasDatedHistory(6)).toBe(true);
    expect(hasDatedHistory(5)).toBe(false);
  });
});

describe("hasBaselineHistory", () => {
  it("requires baseline days plus the recent window", () => {
    expect(hasBaselineHistory(21, 7)).toBe(true);
    expect(hasBaselineHistory(20, 7)).toBe(false);
  });
});
