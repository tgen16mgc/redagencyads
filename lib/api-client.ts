export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function jsonFetch<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(init?.signal?.reason);
  if (init?.signal?.aborted) abortFromCaller();
  else init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "Request failed.");
    }
    return (await response.json()) as T;
  } catch (error) {
    if (isAbortError(error) && controller.signal.aborted && !init?.signal?.aborted) {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. Try again.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", abortFromCaller);
  }
}
