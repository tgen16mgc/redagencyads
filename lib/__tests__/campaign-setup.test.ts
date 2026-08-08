import { describe, expect, it } from "vitest";
import { buildCampaignSetup, summarizeTargeting } from "../campaign-setup";
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
});
