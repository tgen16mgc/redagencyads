import { describe, expect, it } from "vitest";
import {
  buildCampaignSetup,
  filterCampaignSetup,
  statusChipStyle,
  summarizeTargeting,
} from "../campaign-setup";
import { flattenAudienceTargeting } from "../cross-channel";
import { buildSampleReport } from "../sample-report";

describe("campaign setup", () => {
  it("summarizes the targeting fields users need to audit", () => {
    expect(summarizeTargeting({
      age_min: 25,
      age_max: 45,
      genders: [2],
      geo_locations: { countries: ["VN"], cities: [{ name: "Ho Chi Minh City" }] },
      excluded_geo_locations: { cities: [{ name: "Da Nang" }] },
      publisher_platforms: ["facebook", "instagram"],
      flexible_spec: [{ interests: [{ id: "123", name: "Skin care" }] }],
      excluded_custom_audiences: [{ name: "Existing customers" }],
    })).toEqual({
      locations: ["VN", "Ho Chi Minh City", "Excluded: Da Nang"],
      ageRange: "25–45",
      genders: ["Women"],
      advantagePlus: false,
      placements: ["facebook", "instagram"],
      audiences: ["Skin care", "Excluded: Existing customers"],
    });
  });

  it("can read targeting from legacy flattened criteria", () => {
    expect(summarizeTargeting(undefined, [
      "age_min:21",
      "age_max:50",
      "genders:1",
      "geo_locations.countries:vn",
      "publisher_platforms:facebook",
      "flexible_spec.interests.name:fitness",
    ])).toMatchObject({
      locations: ["vn"],
      ageRange: "21–50",
      genders: ["Men"],
      placements: ["facebook"],
      audiences: ["fitness"],
    });
  });

  it("prefers raw Meta targeting when legacy criteria describe the same fields", () => {
    expect(summarizeTargeting(
      {
        age_min: 25,
        age_max: 45,
        geo_locations: { cities: [{ name: "Ho Chi Minh City" }] },
        flexible_spec: [{ interests: [{ name: "Skin care" }] }],
      },
      [
        "age_min:25",
        "age_max:45",
        "geo_locations.cities:Ho Chi Minh City",
        "flexible_spec.interests.name:Skin care",
      ],
    )).toMatchObject({
      locations: ["Ho Chi Minh City"],
      ageRange: "25–45",
      audiences: ["Skin care"],
    });
  });

  it("reads JSON targeting and preserves a custom location radius", () => {
    expect(summarizeTargeting(JSON.stringify({
      age_min: 18,
      age_max: 35,
      genders: [],
      geo_locations: {
        custom_locations: [{
          name: "IA20 Building",
          latitude: 21.0285,
          longitude: 105.8542,
          radius: 2,
          distance_unit: "kilometer",
        }],
        location_types: ["home", "recent"],
      },
    }))).toMatchObject({
      locations: ["IA20 Building · 2 km radius", "People: home", "People: recent"],
      ageRange: "18–35",
      genders: ["All genders / not restricted"],
    });
  });

  it("shows the exact Meta custom-location address and radius", () => {
    expect(summarizeTargeting({
      geo_locations: {
        custom_locations: [{
          address_string: "IA20 Building",
          latitude: 21.0285,
          longitude: 105.8542,
          radius: 2,
          distance_unit: "kilometer",
        }],
      },
    }).locations).toEqual(["IA20 Building · 2 km radius"]);
  });

  it("reads the exact live Meta place name and radius", () => {
    expect(summarizeTargeting({
      age_max: 65,
      age_min: 18,
      age_range: [18, 35],
      geo_locations: {
        places: [{
          key: "1028094113989910",
          name: "Chung Cư IA20 Ciputra KĐT Nam Thăng Long",
          distance_unit: "kilometer",
          latitude: 21.084900504979,
          longitude: 105.78851222992,
          radius: 5,
          country: "VN",
        }],
        location_types: ["home", "recent"],
      },
    })).toMatchObject({
      locations: [
        "Chung Cư IA20 Ciputra KĐT Nam Thăng Long · 5 km radius",
        "People: home",
        "People: recent",
      ],
      ageRange: "18–35",
    });
  });

  it("includes live Meta subcity targeting", () => {
    expect(summarizeTargeting({
      geo_locations: {
        subcities: [{
          key: "2927363",
          country: "VN",
          name: "Quận Đống Đa",
          region: "Hanoi",
        }],
      },
    }).locations).toEqual(["Quận Đống Đa, Hanoi"]);
  });

  it("combines flattened custom-location details with Meta people-location types", () => {
    const criteria = flattenAudienceTargeting({
      geo_locations: {
        custom_locations: [{
          address_string: "IA20 Building",
          radius: 2,
          distance_unit: "kilometer",
        }],
        location_types: ["home", "recent"],
      },
    });

    expect(summarizeTargeting(undefined, criteria).locations).toEqual([
      "IA20 Building · 2 km radius",
      "People: home",
      "People: recent",
    ]);
  });

  it("does not reinterpret excluded flattened locations as included locations", () => {
    const targeting = {
      geo_locations: { cities: [{ name: "Ho Chi Minh City" }] },
      excluded_geo_locations: { cities: [{ name: "Da Nang" }] },
    };

    expect(summarizeTargeting(targeting, flattenAudienceTargeting(targeting)).locations).toEqual([
      "Ho Chi Minh City",
      "Excluded: Da Nang",
    ]);
  });

  it("uses the configured Meta age range instead of broad Advantage delivery bounds", () => {
    expect(summarizeTargeting({
      age_min: 18,
      age_max: 65,
      age_range: [18, 35],
      targeting_automation: {
        advantage_audience: 1,
        individual_setting: { age: 1 },
      },
    }).ageRange).toBe("18–35");
  });

  it("reports whether Advantage+ audience is enabled", () => {
    expect(summarizeTargeting({
      targeting_automation: { advantage_audience: 1 },
    })).toMatchObject({ advantagePlus: true });

    expect(summarizeTargeting({
      targeting_automation: { advantage_audience: 0 },
    })).toMatchObject({ advantagePlus: false });
  });

  it("groups sample ad sets under the campaigns in the active report scope", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1"] });
    const setup = buildCampaignSetup(report);

    expect(setup).toHaveLength(1);
    expect(setup[0]).toMatchObject({
      id: "smp-c1",
      status: "ACTIVE",
    });
    expect(setup[0].adsets.map((adset) => adset.id)).toEqual(["smp-as-11", "smp-as-12"]);
    expect(setup[0].adsets[0].targeting.locations).toContain("Ho Chi Minh City");
  });

  it("does not leak ad-set configuration from outside the report scope", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1"] });
    report.adsetConfigurations = [
      ...(report.adsetConfigurations || []),
      {
        id: "outside-adset",
        name: "Outside scope",
        campaignId: "outside-campaign",
        campaignName: "Outside campaign",
        status: "ACTIVE",
        dailyBudget: 0,
        lifetimeBudget: 0,
        targeting: { age_min: 18, age_max: 65 },
      },
    ];

    expect(buildCampaignSetup(report).map((campaign) => campaign.id)).toEqual(["smp-c1"]);
  });

  it("sorts active campaigns and ad sets before paused ones", () => {
    const report = buildSampleReport({ selectedCampaignIds: ["smp-c1", "smp-c2"] });
    report.selectedCampaigns = [
      { ...report.selectedCampaigns[1], status: "PAUSED", effective_status: "PAUSED" },
      { ...report.selectedCampaigns[0], status: "ACTIVE", effective_status: "ACTIVE" },
    ];
    report.adsetConfigurations = (report.adsetConfigurations || []).map((adset) => {
      if (adset.id === "smp-as-11") return { ...adset, status: "PAUSED" };
      if (adset.id === "smp-as-12") return { ...adset, status: "ACTIVE" };
      return adset;
    });

    const setup = buildCampaignSetup(report);

    expect(setup.map((campaign) => campaign.id)).toEqual(["smp-c1", "smp-c2"]);
    expect(setup[0].adsets.map((adset) => adset.id)).toEqual(["smp-as-12", "smp-as-11"]);
  });

  it("searches campaign and ad-set names without losing matching context", () => {
    const setup = buildCampaignSetup(buildSampleReport());

    const campaignMatch = filterCampaignSetup(setup, "facial combo");
    expect(campaignMatch).toHaveLength(1);
    expect(campaignMatch[0].adsets).toHaveLength(2);

    const adSetMatch = filterCampaignSetup(setup, "retarget 30");
    expect(adSetMatch).toHaveLength(1);
    expect(adSetMatch[0].name).toContain("Acne Treatment");
    expect(adSetMatch[0].adsets.map((adset) => adset.id)).toEqual(["smp-as-22"]);

    expect(filterCampaignSetup(setup, "not a real campaign")).toEqual([]);
  });

  it("uses distinct HeroUI status treatments for active and paused delivery", () => {
    expect(statusChipStyle("ACTIVE")).toEqual({ color: "success", variant: "primary" });
    expect(statusChipStyle("PAUSED")).toEqual({ color: "danger", variant: "primary" });
    expect(statusChipStyle("CAMPAIGN_PAUSED")).toEqual({ color: "danger", variant: "primary" });
  });
});
