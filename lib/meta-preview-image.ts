const META_IMAGE_HOSTS = ["fbcdn.net", "facebook.com", "fbsbx.com"] as const;

export function isAllowedMetaPreviewImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return META_IMAGE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function supportedPdfImageFormat(contentType: string): "JPEG" | "PNG" | null {
  const mime = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mime === "image/jpeg" || mime === "image/jpg") return "JPEG";
  if (mime === "image/png") return "PNG";
  return null;
}
