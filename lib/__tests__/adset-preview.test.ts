import { describe, expect, it } from "vitest";
import { activeAdSetPreviews, buildAdSetPreviewsWithCreatives } from "../adset-preview";
import type { MetaAdSet, MetaCampaign } from "../types";

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

  it("prefers names from the selected campaign collection over stale ad-set payload names", () => {
    const selectedCampaigns: MetaCampaign[] = [
      { id: "c1", name: "Current lead generation" },
      { id: "c2", name: "Current testing" },
    ];

    expect(activeAdSetPreviews(adsets, 12, selectedCampaigns).map((preview) => preview.campaignName)).toEqual([
      "Current lead generation",
      "Current testing",
    ]);
  });

  it("accepts a campaign id-to-name map", () => {
    expect(activeAdSetPreviews(adsets, 12, new Map([["c1", "Mapped campaign"]]))[0].campaignName).toBe(
      "Mapped campaign",
    );
  });

  it("uses an honest fallback with a short identifier when no campaign name can be resolved", () => {
    const unresolved: MetaAdSet[] = [
      {
        id: "adset-without-name",
        name: "Unattributed running set",
        campaign_id: "1056234848479330",
        effective_status: "ACTIVE",
      },
    ];

    expect(activeAdSetPreviews(unresolved)[0].campaignName).toBe("Campaign unavailable · …479330");
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

  it("resolves creative preview campaign names from selected campaigns", () => {
    const result = buildAdSetPreviewsWithCreatives(adsets, ads, previews, [
      { id: "c1", name: "Selected lead campaign" },
      { id: "c2", name: "Selected test campaign" },
    ]);

    expect(result.map((preview) => preview.campaignName)).toEqual([
      "Selected lead campaign",
      "Selected test campaign",
    ]);
  });
});
