const CHAT_RATE_LIMIT = 20;
const CHAT_RATE_WINDOW_MS = 5 * 60 * 1000;

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

export function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

export function chatClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded
    || request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || "local";
}

export function consumeChatRateLimit(key: string, now = Date.now()) {
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + CHAT_RATE_WINDOW_MS });
    return { allowed: true, remaining: CHAT_RATE_LIMIT - 1, retryAfterSeconds: 0 };
  }

  if (current.count >= CHAT_RATE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  if (rateBuckets.size > 1_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }
  return { allowed: true, remaining: CHAT_RATE_LIMIT - current.count, retryAfterSeconds: 0 };
}

export function resetChatRateLimits() {
  rateBuckets.clear();
}
