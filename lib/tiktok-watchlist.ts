import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { workspaceDataPath } from "@/lib/workspace-storage";
import { fetchTikTokAdLibrary } from "@/lib/tiktok";

export type TikTokWatchlist = {
  handles: string[];
  knownCreativeIds: Record<string, string[]>;
  updatedAt?: string;
  lastDigestAt?: string;
  lastDigestDelivery?: {
    deliveredAt: string;
    deliveredForLocalHour: number;
    deliveredForLocalTime?: string;
    deliveryTimezone: string;
    deliveredChannels: string[];
    certificationEnvironment?: string;
    acceptanceMet: boolean;
  };
};

function filePath() {
  return (
    process.env.TIKTOK_WATCHLIST_PATH ||
    workspaceDataPath("tiktok-watchlist.json")
  );
}

function digestTimezone() {
  const configured = process.env.TIKTOK_DIGEST_TIMEZONE || "Asia/Ho_Chi_Minh";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configured }).format();
    return configured;
  } catch {
    return "Asia/Ho_Chi_Minh";
  }
}

function localHourAt(date: Date, timeZone: string) {
  return localTimeAt(date, timeZone).hour;
}

function localTimeAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .formatToParts(date);
  const hour = Number(
    parts.find((part) => part.type === "hour")?.value || 0,
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );
  return {
    hour,
    minute,
    formatted: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

export async function readTikTokWatchlist(): Promise<TikTokWatchlist> {
  try {
    const parsed = JSON.parse(
      await readFile(filePath(), "utf8"),
    ) as TikTokWatchlist;
    return {
      handles: Array.isArray(parsed.handles) ? parsed.handles.slice(0, 50) : [],
      knownCreativeIds: parsed.knownCreativeIds || {},
      updatedAt: parsed.updatedAt,
      lastDigestAt: parsed.lastDigestAt,
      lastDigestDelivery: parsed.lastDigestDelivery,
    };
  } catch {
    return { handles: [], knownCreativeIds: {} };
  }
}

async function writeWatchlist(watchlist: TikTokWatchlist) {
  await mkdir(path.dirname(filePath()), { recursive: true });
  const target = filePath();
  const temporaryPath = `${target}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(watchlist, null, 2), "utf8");
  await rename(temporaryPath, target);
}

export async function saveTikTokWatchlist(handles: string[]) {
  const current = await readTikTokWatchlist();
  const normalized = Array.from(
    new Set(
      handles
        .map((handle) => handle.trim().replace(/^@/u, "").toLocaleLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 50);
  const next = {
    ...current,
    handles: normalized,
    knownCreativeIds: Object.fromEntries(
      Object.entries(current.knownCreativeIds).filter(([handle]) =>
        normalized.includes(handle),
      ),
    ),
    updatedAt: new Date().toISOString(),
  };
  await writeWatchlist(next);
  return next;
}

export async function buildTikTokDailyDigest(input: {
  region?: string;
  maxAdsPerHandle?: number;
  fetcher?: typeof fetchTikTokAdLibrary;
  now?: Date;
}) {
  const watchlist = await readTikTokWatchlist();
  const fetcher = input.fetcher || fetchTikTokAdLibrary;
  const findings: Array<{
    handle: string;
    newCreatives: number;
    rows: Awaited<ReturnType<typeof fetchTikTokAdLibrary>>["rows"];
  }> = [];
  const results = await mapWithConcurrency(
    watchlist.handles,
    5,
    async (handle) => {
      try {
        const report = await fetcher({
          region: input.region || "VN",
          queryType: "1",
          query: handle,
          maxAds: input.maxAdsPerHandle || 20,
          fetchDetails: false,
        });
        const known = new Set(watchlist.knownCreativeIds[handle] || []);
        const newRows = report.rows.filter((row) => !known.has(row.id));
        return {
          handle,
          newCreatives: newRows.length,
          rows: newRows,
          knownCreativeIds: Array.from(
            new Set([...report.rows.map((row) => row.id), ...known]),
          ).slice(0, 1000),
        };
      } catch {
        return {
          handle,
          newCreatives: 0,
          rows: [],
          knownCreativeIds: watchlist.knownCreativeIds[handle] || [],
        };
      }
    },
  );
  for (const result of results) {
    findings.push({
      handle: result.handle,
      newCreatives: result.newCreatives,
      rows: result.rows,
    });
    watchlist.knownCreativeIds[result.handle] = result.knownCreativeIds;
  }
  const generatedAt = input.now || new Date();
  const deliveryTimezone = digestTimezone();
  await writeWatchlist(watchlist);
  return {
    findings,
    totalNewCreatives: findings.reduce(
      (sum, item) => sum + item.newCreatives,
      0,
    ),
    generatedForLocalHour: localHourAt(generatedAt, deliveryTimezone),
    deliveryTimezone,
    generatedAt: generatedAt.toISOString(),
  };
}

export async function recordTikTokDigestDelivery(
  input: {
    deliveredAt?: Date;
    timeZone?: string;
    deliveredChannels?: string[];
  } = {},
) {
  const watchlist = await readTikTokWatchlist();
  const deliveredAt = input.deliveredAt || new Date();
  const deliveryTimezone = input.timeZone || digestTimezone();
  const deliveredLocalTime = localTimeAt(deliveredAt, deliveryTimezone);
  watchlist.lastDigestAt = deliveredAt.toISOString();
  watchlist.lastDigestDelivery = {
    deliveredAt: watchlist.lastDigestAt,
    deliveredForLocalHour: deliveredLocalTime.hour,
    deliveredForLocalTime: deliveredLocalTime.formatted,
    deliveryTimezone,
    deliveredChannels: Array.from(new Set(input.deliveredChannels || [])),
    certificationEnvironment:
      process.env.TIKTOK_ACCEPTANCE_ENVIRONMENT?.trim().toLocaleLowerCase() ||
      "unspecified",
    acceptanceMet:
      deliveredLocalTime.hour * 60 + deliveredLocalTime.minute <= 8 * 60,
  };
  await writeWatchlist(watchlist);
  return watchlist.lastDigestDelivery;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export async function deliverTikTokDigest(input: {
  digest: Awaited<ReturnType<typeof buildTikTokDailyDigest>>;
  slackWebhook?: string;
  emailWebhook?: string;
}) {
  const lines = input.digest.findings
    .filter((item) => item.newCreatives > 0)
    .map((item) => `• @${item.handle}: ${item.newCreatives} new creative(s)`);
  const text = [
    `TikTok competitor digest — ${input.digest.totalNewCreatives} new creative(s)`,
    ...lines,
  ].join("\n");
  const deliveries: Array<{
    channel: string;
    ok: boolean;
    status?: number;
    error?: string;
  }> = [];
  for (const [channel, url, body] of [
    ["slack", input.slackWebhook, { text }],
    [
      "email",
      input.emailWebhook,
      { subject: "TikTok competitor creative digest", text },
    ],
  ] as const) {
    if (!url) continue;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      deliveries.push({ channel, ok: response.ok, status: response.status });
    } catch (error) {
      deliveries.push({
        channel,
        ok: false,
        error:
          error instanceof Error ? error.message : "Webhook delivery failed.",
      });
    }
  }
  return { text, deliveries };
}

export function advertiserCoverage(
  results: Array<{ handle: string; matched: boolean }>,
) {
  const matched = results.filter((result) => result.matched).length;
  const coverage = results.length ? matched / results.length : 0;
  return {
    queried: results.length,
    matched,
    coverage,
    acceptanceMet: coverage >= 0.95,
  };
}

export function scoreCpaCorrelation(
  samples: Array<{ score: number; cpa: number; observedAt?: string }>,
) {
  const observationTimestamps = samples.map((sample) =>
    sample.observedAt ? Date.parse(sample.observedAt) : Number.NaN,
  );
  const dateEvidenceComplete = observationTimestamps.every(Number.isFinite);
  const observationWindowStart = dateEvidenceComplete
    ? new Date(Math.min(...observationTimestamps)).toISOString()
    : null;
  const observationWindowEnd = dateEvidenceComplete
    ? new Date(Math.max(...observationTimestamps)).toISOString()
    : null;
  const observationWindowDays =
    dateEvidenceComplete && observationWindowStart && observationWindowEnd
      ? Math.floor(
          (Date.parse(observationWindowEnd) -
            Date.parse(observationWindowStart)) /
            (24 * 60 * 60 * 1000),
        ) + 1
      : 0;

  if (samples.length < 3)
    return {
      sampleSize: samples.length,
      correlation: 0,
      absoluteCorrelation: 0,
      dateEvidenceComplete,
      observationWindowStart,
      observationWindowEnd,
      observationWindowDays,
      acceptanceMet: false,
    };
  const scoreMean =
    samples.reduce((sum, item) => sum + item.score, 0) / samples.length;
  const cpaMean =
    samples.reduce((sum, item) => sum + item.cpa, 0) / samples.length;
  const covariance = samples.reduce(
    (sum, item) => sum + (item.score - scoreMean) * (item.cpa - cpaMean),
    0,
  );
  const scoreSpread = Math.sqrt(
    samples.reduce((sum, item) => sum + (item.score - scoreMean) ** 2, 0),
  );
  const cpaSpread = Math.sqrt(
    samples.reduce((sum, item) => sum + (item.cpa - cpaMean) ** 2, 0),
  );
  const correlation =
    scoreSpread && cpaSpread ? covariance / (scoreSpread * cpaSpread) : 0;
  return {
    sampleSize: samples.length,
    correlation,
    absoluteCorrelation: Math.abs(correlation),
    dateEvidenceComplete,
    observationWindowStart,
    observationWindowEnd,
    observationWindowDays,
    acceptanceMet:
      Math.abs(correlation) > 0.6 &&
      dateEvidenceComplete &&
      observationWindowDays >= 30,
  };
}
