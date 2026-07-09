import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchTikTokProfiles, fetchTikTokAdLibrary } = vi.hoisted(() => ({
  fetchTikTokProfiles: vi.fn(),
  fetchTikTokAdLibrary: vi.fn(),
}));

vi.mock("@/lib/tiktok", () => ({
  fetchTikTokProfiles,
  fetchTikTokAdLibrary,
}));

describe("TikTok API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches TikTok profiles with capped input", async () => {
    fetchTikTokProfiles.mockResolvedValue({ profiles: [{ username: "redagency" }], videos: [], warnings: [], pulledAt: "now" });
    const { POST } = await import("./tiktok/profiles/route");

    const response = await POST(
      new Request("http://localhost/api/tiktok/profiles", {
        method: "POST",
        body: JSON.stringify({ profiles: ["@redagency"], resultsPerPage: 5 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.profiles).toEqual([{ username: "redagency" }]);
    expect(fetchTikTokProfiles).toHaveBeenCalledWith({ profiles: ["@redagency"], resultsPerPage: 5 });
  });

  it("rejects empty TikTok profile requests", async () => {
    const { POST } = await import("./tiktok/profiles/route");

    const response = await POST(
      new Request("http://localhost/api/tiktok/profiles", {
        method: "POST",
        body: JSON.stringify({ profiles: [] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchTikTokProfiles).not.toHaveBeenCalled();
  });

  it("fetches TikTok ad library rows", async () => {
    fetchTikTokAdLibrary.mockResolvedValue({ rows: [{ id: "ad-1" }], warnings: [], actorId: "actor/id", pulledAt: "now" });
    const { POST } = await import("./tiktok/ads/route");

    const response = await POST(
      new Request("http://localhost/api/tiktok/ads", {
        method: "POST",
        body: JSON.stringify({ region: "VN", queryType: "1", query: "spa", maxAds: 10, fetchDetails: true }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.report.rows).toEqual([{ id: "ad-1" }]);
    expect(fetchTikTokAdLibrary).toHaveBeenCalledWith({
      region: "VN",
      queryType: "1",
      query: "spa",
      startDate: undefined,
      endDate: undefined,
      maxAds: 10,
      fetchDetails: true,
    });
  });

  it("rejects invalid TikTok ad date format", async () => {
    const { POST } = await import("./tiktok/ads/route");

    const response = await POST(
      new Request("http://localhost/api/tiktok/ads", {
        method: "POST",
        body: JSON.stringify({ region: "VN", queryType: "1", query: "spa", startDate: "01-01-2026" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchTikTokAdLibrary).not.toHaveBeenCalled();
  });
});
