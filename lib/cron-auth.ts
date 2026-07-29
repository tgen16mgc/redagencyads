export type CronAuthResult = "missing_secret" | "unauthorized" | null;

export function validateCronRequest(request: Request, env: Record<string, string | undefined> = process.env): CronAuthResult {
  const secret = env.CRON_SECRET;
  if (!secret) return env.NODE_ENV === "production" ? "missing_secret" : null;
  return request.headers.get("authorization") === `Bearer ${secret}` ? null : "unauthorized";
}
