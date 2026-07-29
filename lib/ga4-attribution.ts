export type Ga4AttributionTotals = {
  propertyId: string;
  reportingAttributionModel: string;
  conversions: number;
  revenue: number;
  channels: Array<{ channel: string; conversions: number; revenue: number }>;
  since: string;
  until: string;
  source: "ga4_data_api";
};

function normalizedPropertyId(value: string) {
  const id = value.replace(/\D/gu, "");
  if (!id) throw new Error("A valid GA4 property ID is required.");
  return id;
}

function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  );
}

function reportRows(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  return Array.isArray((payload as { rows?: unknown[] }).rows)
    ? (
        payload as {
          rows: Array<{
            dimensionValues?: Array<{ value?: string }>;
            metricValues?: Array<{ value?: string }>;
          }>;
        }
      ).rows
    : [];
}

function metricValue(
  row: { metricValues?: Array<{ value?: string }> },
  index: number,
) {
  return Number(row.metricValues?.[index]?.value || 0) || 0;
}

export async function fetchGa4DataDrivenAttribution(input: {
  accessToken: string;
  propertyId: string;
  since: string;
  until: string;
  fetchFn?: typeof fetch;
}): Promise<Ga4AttributionTotals> {
  if (
    !validDate(input.since) ||
    !validDate(input.until) ||
    input.since > input.until
  ) {
    throw new Error("A valid GA4 date range is required.");
  }
  const fetchFn = input.fetchFn || fetch;
  const propertyId = normalizedPropertyId(input.propertyId);
  const headers = {
    authorization: `Bearer ${input.accessToken}`,
    "content-type": "application/json",
  };
  const settingsResponse = await fetchFn(
    `https://analyticsadmin.googleapis.com/v1alpha/properties/${propertyId}/attributionSettings`,
    { headers },
  );
  const settings = (await settingsResponse.json().catch(() => ({}))) as {
    reportingAttributionModel?: string;
  };
  if (!settingsResponse.ok)
    throw new Error(
      `GA4 attribution settings fetch failed (${settingsResponse.status}).`,
    );
  const reportingAttributionModel =
    settings.reportingAttributionModel || "UNKNOWN";
  if (!reportingAttributionModel.includes("DATA_DRIVEN"))
    throw new Error(
      `GA4 reporting attribution model is ${reportingAttributionModel}; data-driven attribution is not active.`,
    );

  const reportResponse = await fetchFn(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        dateRanges: [{ startDate: input.since, endDate: input.until }],
        dimensions: [{ name: "defaultChannelGroup" }],
        metrics: [{ name: "keyEvents" }, { name: "totalRevenue" }],
        limit: "1000",
      }),
    },
  );
  const report = await reportResponse.json().catch(() => ({}));
  if (!reportResponse.ok)
    throw new Error(
      `GA4 attribution report failed (${reportResponse.status}).`,
    );
  const channels = reportRows(report).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || "Unassigned",
    conversions: metricValue(row, 0),
    revenue: metricValue(row, 1),
  }));
  return {
    propertyId,
    reportingAttributionModel,
    conversions: channels.reduce((sum, row) => sum + row.conversions, 0),
    revenue: channels.reduce((sum, row) => sum + row.revenue, 0),
    channels,
    since: input.since,
    until: input.until,
    source: "ga4_data_api",
  };
}
