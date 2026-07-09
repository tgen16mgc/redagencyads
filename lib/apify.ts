type ApifyRunArgs = {
  actorId: string;
  input: unknown;
  timeoutSeconds?: number;
};

export async function runApifyActor<T>({ actorId, input, timeoutSeconds = 240 }: ApifyRunArgs): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is required to run Apify actors.");

  const actorPath = actorId.replace("/", "~");
  const url = new URL(`https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items`);
  url.searchParams.set("clean", "true");
  url.searchParams.set("format", "json");
  url.searchParams.set("timeout", String(timeoutSeconds));

  const response = await fetch(url.toString(), {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || "Apify actor run failed.");
  if (!Array.isArray(json)) throw new Error("Apify actor did not return dataset items.");
  return json as T[];
}
