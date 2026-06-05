import { describe, expect, it } from "vitest";
import { activeAdSetPreviews, buildAdSetPreviewsWithCreatives } from "../adset-preview";
import type { MetaAdSet } from "../types";

const adsets: MetaAdSet[] = [
  {
    id: "1",
    name: "Running remarketing",
    campaign_id: "c1",
    campaign_name: "Lead gen",
    effective_status: "ACTIVE",
    status: "ACTIVE",
    daily_budget: "250000",
  },
  {
    id: "2",
    name: "Paused prospecting",
    campaign_id: "c1",
    campaign_name: "Lead gen",
    effective_status: "PAUSED",
    status: "PAUSED",
  },
  {
    id: "3",
    name: "Running testing",
    campaign_id: "c2",
    campaign_name: "Testing",
    effective_status: "ACTIVE",
    status: "ACTIVE",
    lifetime_budget: "900000",
  },
];

const ads = [
  { id: "a1", name: "Image creative", adset_id: "1", status: "ACTIVE" },
  { id: "a2", name: "Video creative", adset_id: "1", status: "ACTIVE" },
  { id: "a3", name: "Inactive ad", adset_id: "2", status: "PAUSED" },
];

const previews = {
  a1: "<iframe>image preview</iframe>",
  a2: "<iframe>video preview</iframe>",
};

describe("activeAdSetPreviews", () => {
  it("returns only currently running ad sets in campaign/name order", () => {
    expect(activeAdSetPreviews(adsets)).toEqual([
      {
        id: "1",
        name: "Running remarketing",
        campaignId: "c1",
        campaignName: "Lead gen",
        status: "ACTIVE",
        dailyBudget: 250000,
        lifetimeBudget: 0,
      },
      {
        id: "3",
        name: "Running testing",
        campaignId: "c2",
        campaignName: "Testing",
        status: "ACTIVE",
        dailyBudget: 0,
        lifetimeBudget: 900000,
      },
    ]);
  });

  it("limits previews after filtering active ad sets", () => {
    expect(activeAdSetPreviews(adsets, 1)).toHaveLength(1);
  });
});

describe("buildAdSetPreviewsWithCreatives", () => {
  it("merges active adsets, ads, and preview iframe HTML", () => {
    const result = buildAdSetPreviewsWithCreatives(adsets, ads, previews);
    expect(result).toEqual([
      {
        id: "1",
        name: "Running remarketing",
        campaignId: "c1",
        campaignName: "Lead gen",
        status: "ACTIVE",
        dailyBudget: 250000,
        lifetimeBudget: 0,
        ads: [
          { id: "a1", name: "Image creative", adsetId: "1", previewHtml: "<iframe>image preview</iframe>" },
          { id: "a2", name: "Video creative", adsetId: "1", previewHtml: "<iframe>video preview</iframe>" },
        ],
      },
      {
        id: "3",
        name: "Running testing",
        campaignId: "c2",
        campaignName: "Testing",
        status: "ACTIVE",
        dailyBudget: 0,
        lifetimeBudget: 900000,
        ads: [],
      },
    ]);
  });
});
