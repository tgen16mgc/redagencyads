import { describe, expect, it, vi } from "vitest";
import { fetchGa4DataDrivenAttribution } from "@/lib/ga4-attribution";

describe("GA4 data-driven attribution", () => {
  it("verifies the property model and aggregates attributed channel rows", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            reportingAttributionModel: "CROSS_CHANNEL_DATA_DRIVEN",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rows: [
              {
                dimensionValues: [{ value: "Paid Social" }],
                metricValues: [{ value: "12" }, { value: "2400" }],
              },
              {
                dimensionValues: [{ value: "Paid Search" }],
                metricValues: [{ value: "8" }, { value: "1600" }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await fetchGa4DataDrivenAttribution({
      accessToken: "token",
      propertyId: "properties/123456",
      since: "2026-07-01",
      until: "2026-07-28",
      fetchFn,
    });
    expect(result).toMatchObject({
      propertyId: "123456",
      conversions: 20,
      revenue: 4000,
      source: "ga4_data_api",
    });
    expect(result.channels).toHaveLength(2);
    expect(JSON.parse(String(fetchFn.mock.calls[1][1]?.body))).toMatchObject({
      dimensions: [{ name: "defaultChannelGroup" }],
    });
  });

  it("rejects properties that are not configured for data-driven reporting", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            reportingAttributionModel: "CROSS_CHANNEL_LAST_CLICK",
          }),
          { status: 200 },
        ),
      );
    await expect(
      fetchGa4DataDrivenAttribution({
        accessToken: "token",
        propertyId: "123456",
        since: "2026-07-01",
        until: "2026-07-28",
        fetchFn,
      }),
    ).rejects.toThrow("data-driven attribution is not active");
  });
});
