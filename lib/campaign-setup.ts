import type { AdSetConfiguration, DashboardReport, MetaCampaign, NormalizedRow } from "@/lib/types";

export type TargetingSummary = {
  locations: string[];
  ageRange: string;
  genders: string[];
  placements: string[];
  audiences: string[];
};

export type AdSetSetup = {
  id: string;
  name: string;
  status: string;
  dailyBudget: number;
  lifetimeBudget: number;
  optimizationGoal?: string;
  billingEvent?: string;
  bidStrategy?: string;
  startTime?: string;
  endTime?: string;
  targeting: TargetingSummary;
};

export type CampaignSetup = {
  id: string;
  name: string;
  objective?: string;
  status: string;
  dailyBudget: number;
  lifetimeBudget: number;
  adsets: AdSetSetup[];
};

function stringValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.name === "string") return [record.name];
  if (typeof record.key === "string") return [record.key];
  return Object.values(record).flatMap(stringValues);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "string") {
    try {
      return recordValue(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function compactCoordinate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(5).replace(/0+$/u, "").replace(/\.$/u, "") : "";
}

function distanceLabel(radius: unknown, unit: unknown) {
  const amount = Number(radius);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const normalized = String(unit || "").toLowerCase();
  const suffix = normalized.startsWith("kilo") ? "km" : normalized.startsWith("mile") ? "mi" : normalized.startsWith("meter") ? "m" : normalized;
  return `${amount} ${suffix || "radius"}`;
}

function locationValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(locationValues);
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  const record = recordValue(value);
  if (!record) return [];
  const name = [record.name, record.region, record.country_code]
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
    .join(", ");
  const coordinates = [compactCoordinate(record.latitude), compactCoordinate(record.longitude)].filter(Boolean).join(", ");
  const base = name || coordinates || (typeof record.key === "string" ? record.key : "");
  const radius = distanceLabel(record.radius, record.distance_unit);
  return base ? [`${base}${radius ? ` · ${radius} radius` : ""}`] : Object.values(record).flatMap(locationValues);
}

function nested(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function valuesAt(value: unknown, paths: string[][]): string[] {
  return paths.flatMap((path) => stringValues(nested(value, path)));
}

function locationsAt(value: unknown, paths: string[][]): string[] {
  return paths.flatMap((path) => locationValues(nested(value, path)));
}

function collectNamed(value: unknown, parentKey = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => collectNamed(item, parentKey));
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const audienceKeys = new Set(["interests", "behaviors", "custom_audiences", "excluded_custom_audiences", "life_events", "industries", "work_positions"]);
  const ownName = audienceKeys.has(parentKey) && typeof record.name === "string"
    ? [parentKey.startsWith("excluded_") ? `Excluded: ${record.name}` : record.name]
    : [];
  return ownName.concat(Object.entries(record).flatMap(([key, item]) => collectNamed(item, key)));
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function criteriaMap(criteria: string[]) {
  const map = new Map<string, string[]>();
  for (const criterion of criteria) {
    const separator = criterion.indexOf(":");
    if (separator < 1) continue;
    const key = criterion.slice(0, separator);
    const value = criterion.slice(separator + 1);
    map.set(key, [...(map.get(key) || []), value]);
  }
  return map;
}

function criteriaValues(map: Map<string, string[]>, fragments: string[]) {
  return unique([...map.entries()].flatMap(([key, values]) => fragments.some((fragment) => key.includes(fragment)) ? values : []));
}

export function summarizeTargeting(targeting: unknown, criteria: string[] = []): TargetingSummary {
  const normalizedTargeting = recordValue(targeting);
  const fallback = criteriaMap(criteria);
  const ageMin = Number(nested(normalizedTargeting, ["age_min"]) ?? fallback.get("age_min")?.[0]);
  const ageMax = Number(nested(normalizedTargeting, ["age_max"]) ?? fallback.get("age_max")?.[0]);
  const genderCodes = valuesAt(normalizedTargeting, [["genders"]]);
  const genders = unique((genderCodes.length ? genderCodes : criteriaValues(fallback, ["genders"])).map((value) => {
    if (value === "1") return "Men";
    if (value === "2") return "Women";
    return value;
  }));
  const includedLocations = locationsAt(normalizedTargeting, [["geo_locations", "countries"], ["geo_locations", "regions"], ["geo_locations", "cities"], ["geo_locations", "zips"], ["geo_locations", "custom_locations"], ["geo_locations", "geo_markets"]]);
  const excludedLocations = locationsAt(normalizedTargeting, [["excluded_geo_locations", "countries"], ["excluded_geo_locations", "regions"], ["excluded_geo_locations", "cities"], ["excluded_geo_locations", "zips"], ["excluded_geo_locations", "custom_locations"], ["excluded_geo_locations", "geo_markets"]]);
  const locationTypes = valuesAt(normalizedTargeting, [["geo_locations", "location_types"]]);
  const rawLocations = [
    ...includedLocations,
    ...locationTypes.map((value) => `People: ${value}`),
    ...excludedLocations.map((value) => `Excluded: ${value}`),
  ];
  const fallbackLocations = [
    ...criteriaValues(fallback, ["geo_locations.countries", "geo_locations.regions", "geo_locations.cities", "geo_locations.zips", "geo_locations.custom_locations.name", "geo_locations.geo_markets"]),
    ...criteriaValues(fallback, ["excluded_geo_locations.countries", "excluded_geo_locations.regions", "excluded_geo_locations.cities", "excluded_geo_locations.zips", "excluded_geo_locations.custom_locations.name", "excluded_geo_locations.geo_markets"]).map((value) => `Excluded: ${value}`),
  ];
  const locations = unique([
    ...(rawLocations.length ? rawLocations : fallbackLocations),
  ]);
  const rawPlacements = valuesAt(normalizedTargeting, [["publisher_platforms"], ["facebook_positions"], ["instagram_positions"], ["messenger_positions"], ["device_platforms"]]);
  const placements = unique(rawPlacements.length ? rawPlacements : criteriaValues(fallback, ["publisher_platforms", "facebook_positions", "instagram_positions", "messenger_positions", "device_platforms"]));
  const rawAudiences = collectNamed(normalizedTargeting);
  const audiences = unique(rawAudiences.length ? rawAudiences : criteriaValues(fallback, ["interests.name", "behaviors.name", "custom_audiences.name", "life_events.name", "industries.name", "work_positions.name"]));

  return {
    locations,
    ageRange: Number.isFinite(ageMin) || Number.isFinite(ageMax)
      ? `${Number.isFinite(ageMin) ? ageMin : "Minimum not set"}–${Number.isFinite(ageMax) ? ageMax : "Maximum not set"}`
      : "Not provided by Meta",
    genders: genders.length ? genders : ["All genders / not restricted"],
    placements,
    audiences,
  };
}

function fallbackConfiguration(row: NormalizedRow, campaignName: string): AdSetConfiguration {
  return {
    id: row.adsetId || row.id,
    name: row.adsetName || row.name,
    campaignId: row.campaignId || "",
    campaignName,
    status: "UNKNOWN",
    dailyBudget: row.dailyBudget || 0,
    lifetimeBudget: 0,
  };
}

function campaignFromRow(row: NormalizedRow): MetaCampaign {
  return {
    id: row.campaignId || row.id,
    name: row.campaignName || row.name,
    status: "UNKNOWN",
  };
}

export function buildCampaignSetup(report: DashboardReport): CampaignSetup[] {
  const targetingByAdSet = new Map((report.adsetTargeting || []).map((item) => [item.adSetId, item.criteria]));
  const campaigns = new Map<string, MetaCampaign>();
  for (const campaign of report.selectedCampaigns) campaigns.set(campaign.id, campaign);
  for (const row of report.campaignRows) {
    const campaign = campaignFromRow(row);
    if (!campaigns.has(campaign.id)) campaigns.set(campaign.id, campaign);
  }

  const configurations = new Map((report.adsetConfigurations || []).map((item) => [item.id, item]));
  for (const preview of report.adsetPreviews || []) {
    if (!configurations.has(preview.id)) configurations.set(preview.id, preview);
  }
  for (const row of report.adsetRows) {
    const id = row.adsetId || row.id;
    if (!configurations.has(id)) configurations.set(id, fallbackConfiguration(row, row.campaignName || "Campaign unavailable"));
  }

  const scopedCampaignIds = new Set(campaigns.keys());
  for (const [id, configuration] of configurations) {
    if (scopedCampaignIds.size && !scopedCampaignIds.has(configuration.campaignId)) configurations.delete(id);
  }

  for (const configuration of configurations.values()) {
    if (!configuration.campaignId || campaigns.has(configuration.campaignId)) continue;
    campaigns.set(configuration.campaignId, {
      id: configuration.campaignId,
      name: configuration.campaignName,
      status: "UNKNOWN",
    });
  }

  return [...campaigns.values()].map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.effective_status || campaign.status || "UNKNOWN",
    dailyBudget: Number(campaign.daily_budget || 0),
    lifetimeBudget: Number(campaign.lifetime_budget || 0),
    adsets: [...configurations.values()]
      .filter((adset) => adset.campaignId === campaign.id)
      .map((adset) => ({
        id: adset.id,
        name: adset.name,
        status: adset.status,
        dailyBudget: adset.dailyBudget,
        lifetimeBudget: adset.lifetimeBudget,
        optimizationGoal: adset.optimizationGoal,
        billingEvent: adset.billingEvent,
        bidStrategy: adset.bidStrategy,
        startTime: adset.startTime,
        endTime: adset.endTime,
        targeting: summarizeTargeting(adset.targeting, targetingByAdSet.get(adset.id)),
      })),
  }));
}
