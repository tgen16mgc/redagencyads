import { describe, expect, it } from "vitest";
import { isAllowedMetaPreviewImageUrl, supportedPdfImageFormat } from "../meta-preview-image";

describe("Meta preview image safety", () => {
  it("allows only HTTPS Meta image hosts", () => {
    expect(isAllowedMetaPreviewImageUrl("https://scontent.fsgn2-9.fna.fbcdn.net/ad.jpg")).toBe(true);
    expect(isAllowedMetaPreviewImageUrl("https://lookaside.facebook.com/ad.jpg")).toBe(true);
    expect(isAllowedMetaPreviewImageUrl("http://scontent.fsgn2-9.fna.fbcdn.net/ad.jpg")).toBe(false);
    expect(isAllowedMetaPreviewImageUrl("https://fbcdn.net.example.com/ad.jpg")).toBe(false);
  });

  it("accepts PDF-safe raster formats only", () => {
    expect(supportedPdfImageFormat("image/jpeg; charset=binary")).toBe("JPEG");
    expect(supportedPdfImageFormat("image/png")).toBe("PNG");
    expect(supportedPdfImageFormat("image/webp")).toBeNull();
  });
});
