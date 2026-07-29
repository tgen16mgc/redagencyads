import { createHash } from "node:crypto";

export async function sha256ResponseBody(response: Response, maxBytes: number) {
  if (!response.body) throw new Error("Media response body is empty.");
  const reader = response.body.getReader();
  const hash = createHash("sha256");
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Media exceeds the ${maxBytes}-byte hashing limit.`);
    }
    hash.update(chunk.value);
  }
  if (!total) throw new Error("Media response body is empty.");
  return `sha256:${hash.digest("hex")}`;
}

export async function fetchHttpsMediaSha256(input: {
  mediaUrl: string;
  maxBytes: number;
  timeoutMs: number;
  fetchFn?: typeof fetch;
}) {
  const url = new URL(input.mediaUrl);
  if (url.protocol !== "https:")
    throw new Error("Only HTTPS media can be hashed.");
  const response = await (input.fetchFn || fetch)(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  if (!response.ok) throw new Error(`Media fetch failed (${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  if (/^(?:text\/|application\/(?:json|xml))/iu.test(contentType))
    throw new Error(`Media response has unsupported type ${contentType}.`);
  return sha256ResponseBody(response, input.maxBytes);
}

export function boundedMediaHashNumber(
  explicit: number | undefined,
  configured: string | undefined,
  fallback: number,
  minimum: number,
) {
  const candidate =
    explicit ?? (configured === undefined ? fallback : Number(configured));
  return Number.isFinite(candidate) ? Math.max(minimum, candidate) : fallback;
}
