import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCompetitorAds, parsePublicMetaLibraryHtml } from "../competitor-spy";

describe("fetchCompetitorAds", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns no-key public evidence cards when Apify credentials are missing", async () => {
    vi.stubEnv("APIFY_TOKEN", "");
    vi.stubEnv("APIFY_META_ADS_ACTOR_ID", "");

    const result = await fetchCompetitorAds({
      source: "apify",
      competitors: ["Seoul Spa"],
      country: "VN",
      limit: 5,
      libraryUrls: [],
    });

    expect(result.source).toBe("public");
    expect(result.ads).toHaveLength(1);
    expect(result.ads[0]).toMatchObject({
      competitorName: "Seoul Spa",
      pageName: "Seoul Spa",
      source: "public",
      headline: "Open Meta Ad Library search",
    });
    expect(result.ads[0].snapshotUrl).toContain("facebook.com/ads/library");
    expect(result.warnings.join(" ")).toContain("No Apify credentials");
  });

  it("extracts ad cards from public Meta Ad Library HTML", () => {
    const html = String.raw`
      <script>
        require("RelayPrefetchedStreamCache").next({"__bbox":{"result":{
          "data":{
            "ad_archive_id":"987654321",
            "page_name":"Seoul Spa",
            "publisher_platform":["FACEBOOK","INSTAGRAM"],
            "snapshot":{
              "body":{"text":"Book a skin consultation today"},
              "title":"Clear skin plan",
              "caption":"seoulspa.vn",
              "cta_text":"Send message",
              "link_url":"https:\/\/seoulspa.vn\/consult",
              "images":[{"resized_image_url":"https:\/\/images.example\/ad.jpg"}],
              "videos":[{"video_hd_url":"https:\/\/videos.example\/ad.mp4"}]
            },
            "start_date":1779778800,
            "ad_snapshot_url":"https:\/\/www.facebook.com\/ads\/library\/?id=987654321"
          }
        }});
      </script>
    `;

    const ads = parsePublicMetaLibraryHtml(html, {
      competitorName: "Seoul Spa",
      sourceUrl: "https://www.facebook.com/ads/library/?q=Seoul%20Spa",
      limit: 5,
    });

    expect(ads).toHaveLength(1);
    expect(ads[0]).toMatchObject({
      id: "987654321",
      source: "public",
      competitorName: "Seoul Spa",
      pageName: "Seoul Spa",
      platform: "FACEBOOK, INSTAGRAM",
      body: "Book a skin consultation today",
      headline: "Clear skin plan",
      cta: "Send message",
      landingUrl: "https://seoulspa.vn/consult",
      snapshotUrl: "https://www.facebook.com/ads/library/?id=987654321",
      imageUrl: "https://images.example/ad.jpg",
      videoUrl: "https://videos.example/ad.mp4",
    });
    expect(ads[0].startDate).toContain("2026");
  });
});
